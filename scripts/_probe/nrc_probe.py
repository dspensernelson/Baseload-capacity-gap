import requests, sys
B = "https://www.nrc.gov"
OLD = B + "/reactors/operating/licensing/renewal/subsequent-license-renewal.html"
NEW = B + "/licensing-applications/operating-reactor-licensing/reactor-license-renewal/status-subsequent-license-renewal-applications"
CHROME = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
          "Chrome/126.0.0.0 Safari/537.36")
BOT = "Mozilla/5.0 (compatible; BaseloadBot/1.0; +https://baseload-capacity-gap.vercel.app)"
BROWSER_HDRS = {"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9"}
variants = {
  "bot-ua session":            (BOT, {}),
  "python-requests default":   (None, {}),
  "chrome-ua session":         (CHROME, {}),
  "chrome-ua + accept hdrs":   (CHROME, BROWSER_HDRS),
  "bot-ua + accept hdrs":      (BOT, BROWSER_HDRS),
  "plain 'baseload-capacity-gap'": ("baseload-capacity-gap", {}),
}
for url_label, url in (("OLD(redirects)", OLD), ("NEW(direct)", NEW)):
    for name, (ua, extra) in variants.items():
        s = requests.Session()
        if ua: s.headers["User-Agent"] = ua
        s.headers.update(extra)
        try:
            r = s.get(url, timeout=60)
            print(f"{url_label:15} {name:32} -> {r.status_code} hops={[h.status_code for h in r.history]} len={len(r.text)}")
            if r.status_code == 403 and name == "bot-ua session":
                print("   403 headers:", dict(r.headers)); print("   403 body[:400]:", r.text[:400].replace("\n", " "))
        except Exception as e:
            print(f"{url_label:15} {name:32} -> EXC {e}")
