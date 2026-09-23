#!./sharc

; Venture News starts the standard Sharc server with a small, persistent
; venture-deal data layer added after the normal news routes are loaded.

(load "news.arc")
(load "venture.arc")

(nsv)
(main-repl)
