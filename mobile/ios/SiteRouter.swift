// --- added by mobile/ios/capacitor.mjs (patch): the site is many pages, not one ---

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

/// The app's web view: Capacitor's, with the site's router.
class SiteViewController: CAPBridgeViewController {
    override func router() -> Router {
        return SiteRouter()
    }
}
