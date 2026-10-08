import SwiftUI

struct RootView: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        ZStack {
            // The phone app's deep-green screen colour, darkening toward the bottom.
            LinearGradient(colors: [.vitalisGreen, .vitalisDeep], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            screen
                .id(model.screen)
                .transition(.asymmetric(insertion: .opacity.combined(with: .scale(scale: 0.94)), removal: .opacity))
        }
        .animation(.easeOut(duration: 0.35), value: model.screen)
    }

    @ViewBuilder private var screen: some View {
        switch model.screen {
        case .pair: PairView()
        case .home: HomeView()
        case .countdown: CountdownView()
        case .areYouOk: AreYouOkView()
        case let .sending(reason, bpm): SendingView(reason: reason, bpm: bpm)
        case .status: StatusView()
        case .medical: MedicalView()
        case .noLocation: NoLocationView()
        }
    }
}
