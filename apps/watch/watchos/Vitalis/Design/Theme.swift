import SwiftUI

/// Vitalis colours. Same values as the phone app and the Wear OS app (apps/watch/README.md).
extension Color {
    static let vitalisGreen = Color(hex: 0x0C5D57)   // screen background, top
    static let vitalisDeep = Color(hex: 0x084540)    // screen background, bottom
    static let vitalisTeal = Color(hex: 0x14A897)    // live, selected, primary actions
    static let sos = Color(hex: 0xE14545)            // SOS and danger only
    static let paper = Color(hex: 0xF7F5F0)          // cards
    static let paperPressed = Color(hex: 0xE6E2D8)
    static let ink = Color(hex: 0x13201F)            // text on cards
    static let inkMuted = Color(hex: 0x556362)

    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}
