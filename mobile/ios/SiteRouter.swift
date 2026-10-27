// --- added by mobile/ios/capacitor.mjs (patch): the site is many pages, not one ---

import WebKit

/// Serves the bundled site's folders as pages: /pdf/ -> /pdf/index.html. Capacitor's own router sends every path
/// without an extension to the root index.html (a single-page app's rule), which would open the homepage for every app.
/// A folder without a page gets the site's 404 page.
struct SiteRouter: Router {
    var basePath: String = ""

    func route(for path: String) -> String {
        if !URL(fileURLWithPath: path).pathExtension.isEmpty {
            return basePath + path
        }
        let page = (path.hasSuffix("/") ? path : path + "/") + "index.html"
        if FileManager.default.fileExists(atPath: basePath + page) {
            return basePath + page
        }
        return basePath + "/404.html"
    }
}

/// The app's web view: Capacitor's, with the site's router, kept inside the safe area (below the status bar, the notch
/// or the Dynamic Island, clear of a landscape notch and above the home indicator), so every page fits without
/// knowing it is in an app. The bands around it take the page's own colours, which the page glue (native.js) reports
/// through the "siteChrome" message: the top band the colour at the page's top edge, the rest the colour at its
/// bottom edge. The status bar text follows the top band (dark on light, light on dark).
class SiteViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private let topBand = UIView()

    override func router() -> Router {
        return SiteRouter()
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let web = webView else { return }
        let box = UIView(frame: web.frame)
        box.backgroundColor = web.backgroundColor ?? .systemBackground
        topBand.backgroundColor = box.backgroundColor
        view = box
        for v in [topBand, web] as [UIView] { v.translatesAutoresizingMaskIntoConstraints = false; box.addSubview(v) }
        let safe = box.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: safe.topAnchor),
            web.bottomAnchor.constraint(equalTo: safe.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
            topBand.topAnchor.constraint(equalTo: box.topAnchor),
            topBand.bottomAnchor.constraint(equalTo: safe.topAnchor),
            topBand.leadingAnchor.constraint(equalTo: box.leadingAnchor),
            topBand.trailingAnchor.constraint(equalTo: box.trailingAnchor),
        ])
        web.configuration.userContentController.add(WeakMessageHandler(self), name: "siteChrome")
    }

    /// { top: [r, g, b], bottom: [r, g, b] } (0-255) from the page glue.
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let m = message.body as? [String: Any] else { return }
        if let top = SiteViewController.color(m["top"]) {
            topBand.backgroundColor = top.color
            setStatusBarStyle(top.light ? .darkContent : .lightContent)
        }
        if let rest = SiteViewController.color(m["bottom"]) { view.backgroundColor = rest.color }
    }

    private static func color(_ v: Any?) -> (color: UIColor, light: Bool)? {
        guard let a = v as? [NSNumber], a.count >= 3 else { return nil }
        let r = a[0].doubleValue / 255, g = a[1].doubleValue / 255, b = a[2].doubleValue / 255
        return (UIColor(red: r, green: g, blue: b, alpha: 1), 0.299 * r + 0.587 * g + 0.114 * b > 0.55)
    }
}

/// The message handler without a strong reference (the web view's content controller keeps its handlers).
class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(ucc, didReceive: message)
    }
}
