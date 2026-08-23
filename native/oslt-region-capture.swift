import Foundation
import ImageIO
import ScreenCaptureKit
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 7,
      let x = Double(CommandLine.arguments[1]),
      let y = Double(CommandLine.arguments[2]),
      let width = Double(CommandLine.arguments[3]),
      let height = Double(CommandLine.arguments[4]),
      let excludedPID = Int32(CommandLine.arguments[5]) else {
    fputs("usage: oslt-region-capture x y width height pid output.png\n", stderr)
    exit(2)
}

let outputPath = CommandLine.arguments[6]
let region = CGRect(x: x, y: y, width: width, height: height)

func writePNG(_ image: CGImage, to outputPath: String) throws {
    guard let destination = CGImageDestinationCreateWithURL(
        URL(fileURLWithPath: outputPath) as CFURL,
        UTType.png.identifier as CFString,
        1,
        nil
    ) else {
        throw NSError(domain: "OSLT", code: 1, userInfo: [NSLocalizedDescriptionKey: "could not create PNG destination"])
    }

    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else {
        throw NSError(domain: "OSLT", code: 2, userInfo: [NSLocalizedDescriptionKey: "could not write PNG"])
    }
}

let semaphore = DispatchSemaphore(value: 0)
Task {
    defer { semaphore.signal() }
    do {
        let content = try await SCShareableContent.excludingDesktopWindows(
            false,
            onScreenWindowsOnly: true
        )
        guard let display = content.displays.first(where: { $0.frame.intersects(region) }) else {
            throw NSError(domain: "OSLT", code: 3, userInfo: [NSLocalizedDescriptionKey: "no display contains capture region"])
        }

        let excludedWindows = content.windows.filter {
            $0.owningApplication?.processID == excludedPID
        }
        let filter = SCContentFilter(display: display, excludingWindows: excludedWindows)
        let displayScale = CGFloat(display.width) / max(display.frame.width, 1)
        let configuration = SCStreamConfiguration()
        configuration.sourceRect = CGRect(
            x: region.minX - display.frame.minX,
            y: region.minY - display.frame.minY,
            width: region.width,
            height: region.height
        )
        configuration.width = max(1, Int(region.width * displayScale))
        configuration.height = max(1, Int(region.height * displayScale))
        configuration.showsCursor = false

        let image = try await SCScreenshotManager.captureImage(
            contentFilter: filter,
            configuration: configuration
        )
        try writePNG(image, to: outputPath)
    } catch {
        fputs("capture failed: \(error)\n", stderr)
        exit(1)
    }
}
semaphore.wait()
