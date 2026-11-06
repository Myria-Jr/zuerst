import SwiftUI

struct DockAction {
    let title: String
    let symbol: String
    var alternative: (() -> Void)? = nil
    let perform: () -> Void
}

struct GlassDock: View {
    let action: DockAction
    let accent: Color
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @Namespace private var glass

    var body: some View {
        GlassEffectContainer(spacing: 16) {
            let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 8)) : AnyLayout(HStackLayout(spacing: 8))
            layout {
                control(action.title, symbol: action.symbol, primary: true, perform: action.perform)
                    .glassEffectID("primary", in: glass)
                if let alternative = action.alternative {
                    control("Andere Idee", symbol: "arrow.clockwise", primary: false, perform: alternative)
                        .glassEffectID("alternative", in: glass)
                }
            }
        }
    }

    private func control(_ title: String, symbol: String, primary: Bool, perform: @escaping () -> Void) -> some View {
        Button(action: perform) {
            Label(title, systemImage: symbol)
                .font(.headline)
                .multilineTextAlignment(.center)
                .frame(maxWidth: primary ? .infinity : nil, minHeight: 52)
                .padding(.horizontal, 15)
                .padding(.vertical, 3)
                .contentShape(.capsule)
        }
        .buttonStyle(.plain)
        .modifier(DockMaterial(accent: accent, primary: primary, reduceTransparency: reduceTransparency, reduceMotion: reduceMotion))
    }
}

private struct DockMaterial: ViewModifier {
    let accent: Color
    let primary: Bool
    let reduceTransparency: Bool
    let reduceMotion: Bool

    func body(content: Content) -> some View {
        if reduceTransparency {
            content.background(.background, in: .capsule)
                .overlay { Capsule().strokeBorder(accent.opacity(primary ? 0.75 : 0.35), lineWidth: 1) }
        } else {
            let material = Glass.regular.tint(primary ? accent.opacity(0.23) : .clear)
            content.glassEffect(reduceMotion ? material : material.interactive(), in: .capsule)
        }
    }
}

struct MeshBackdrop: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorScheme) private var colorScheme
    @State private var origin = Date.now

    var body: some View {
        Group {
            if reduceTransparency {
                Color(uiColor: .systemGroupedBackground)
            } else {
                TimelineView(.explicit([origin])) { _ in
                    let seconds = 0.0
                    let x = Float(sin(seconds * 0.29)) * 0.12
                    let y = Float(cos(seconds * 0.23)) * 0.09
                    MeshGradient(width: 3, height: 3, points: [
                        [0, 0], [0.47 + x * 0.3, 0], [1, 0],
                        [0, 0.52 + y * 0.4], [0.48 + x, 0.54 + y], [1, 0.54 - y * 0.4],
                        [0, 1], [0.60 - x * 0.4, 1], [1, 1],
                    ], colors: colorScheme == .dark ? dark : light)
                }
            }
        }.ignoresSafeArea().accessibilityHidden(true)
    }

    private var light: [Color] {
        [color(0xF9EFE2), color(0xF1DDE9), color(0xDDECF1), color(0xF7E7DB), color(0xF8F1E5),
         color(0xD6E7F2), color(0xEFEAD9), color(0xE7EDCA), color(0xDFDFF1)]
    }

    private var dark: [Color] {
        [color(0x231C27), color(0x3C293A), color(0x1E3242), color(0x34252E), color(0x231C2A),
         color(0x263C46), color(0x2C2F21), color(0x324025), color(0x2F2A42)]
    }

    private func color(_ hex: Int) -> Color {
        Color(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
}
