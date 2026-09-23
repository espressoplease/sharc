; Persistent data and routes for Venture News.

(= venture-dir*       (string arcdir* "venture/")
   venture-data-path* (string venture-dir* "deals.json")
   venture-seed-path* (string staticdir* "venture-deals.seed.json"))

; Keep the original News application intact, but brand this instance as Venture
; News and add its research strip above Sharc's normal HN header.
(= this-site* "Venture News"
   site-desc* "Venture funding and startup news"
   site-color* (color 216 232 219)
   border-color* (color 57 127 80)
   logo-url* "venture-logo.svg"
   favicon-url* "venture-logo.svg")

; Native News pages retain Sharc's stylesheet and receive the small Venture
; News extension stylesheet for the strip above their header.
(def gen-css-url ()
  (do (gentag link rel 'stylesheet type 'text/css href (static-src "news.css"))
      (gentag link rel 'stylesheet type 'text/css href (static-src "venture.css"))))

(def site-or-hn-url () "/")

(def ensure-venture-data ()
  (ensure-dir venture-dir*)
  (unless (file-exists venture-data-path*)
    (copyfile venture-seed-path* venture-data-path*)))

; Static data is intentionally seeded only once.  Subsequent imports update
; arc/venture/deals.json, which is excluded from git and survives deployments.
(def venture-data-json ()
  (let url (string "http://127.0.0.1:" (readenv "VENTURE_DATA_PORT" 8787) "/deals")
    (aif (errsafe:http-response url (obj timeout 2 maxtime 3))
         it!body
         (do (ensure-venture-data)
             (filechars venture-data-path*)))))

(newsopr venture ()
  "venture.html")

(newsopr venture-data.json ()
  (responding type-header*!json (prn)
    (pr (venture-data-json))))

; This is intentionally a small preview. The main dashboard remains at
; /venture.html, while every original Sharc page retains its users, votes,
; submissions, comments, and navigation beneath the strip.
(def venture-strip ()
  (tag (div id "venture-strip" class "venture-strip")
    (tag (div class "venture-strip-head")
      (tag (span class "venture-strip-kicker") (pr "VENTURE ROUNDS"))
      (tag (span id "venture-strip-summary" class "venture-strip-summary") (pr "loading sourced rounds..."))
      (tag (a class "venture-strip-open" href "venture-data.json") (pr "export JSON"))
      (tag (button id "venture-strip-toggle" class "venture-strip-toggle" type "button") (pr "collapse")))
    (tag (div id "venture-strip-body" class "venture-strip-body")
      (tag (div id "venture-dashboard" class "venture-dashboard")
        (pr "Loading the funding landscape..."))))
  (tag (script src (static-src "venture-strip.js"))))

; Override only the presentation wrapper used by the stock News pages. All
; routes and application logic are still supplied by the unmodified Sharc app.
(def pagetop (switch lid label (o title) (o whence))
  (tr (tdcolor (main-color)
        (tag (table class "venture-header-shell" border 0 cellpadding 0 cellspacing 0 width "100%"
                    style "padding:2px")
          (tag (tr)
            (tag (td colspan "3" style "padding:0 0 3px 0;")
              (venture-strip)))
          (tr (gen-logo)
              (when (is switch 'full)
                (tag (td style "line-height:12pt; height:10px;")
                  (spanclass pagetop
                    (tag (b class 'hnname)
                      (link this-site* (site-or-hn-url)))
                    (toprow label))))
             (if (is switch 'full)
                 (tag (td style "text-align:right;padding-right:4px;")
                   (spanclass pagetop (topright whence)))
                 (tag (td style "line-height:12pt; height:10px;")
                   (spanclass pagetop (prbold label))))))))
  (each f pagefns* (f))
  (spacerow 10))
