; Persistent data and routes for Venture News.

(= venture-dir*       (string arcdir* "venture/")
   venture-data-path* (string venture-dir* "deals.json")
   venture-seed-path* (string staticdir* "venture-deals.seed.json"))

(def ensure-venture-data ()
  (ensure-dir venture-dir*)
  (unless (file-exists venture-data-path*)
    (copyfile venture-seed-path* venture-data-path*)))

; Static data is intentionally seeded only once.  Subsequent imports update
; arc/venture/deals.json, which is excluded from git and survives deployments.
(def venture-data-json ()
  (ensure-venture-data)
  (filechars venture-data-path*))

(newsopr venture ()
  "venture.html")

(newsopr venture-data.json ()
  (responding type-header*!json (prn)
    (pr (venture-data-json))))
