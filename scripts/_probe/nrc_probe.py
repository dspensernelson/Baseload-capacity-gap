import requests, time, collections
B = "https://www.nrc.gov"
URLS = {
  "SLR-old": B + "/reactors/operating/licensing/renewal/subsequent-license-renewal.html",
  "LR-old":  B + "/reactors/operating/licensing/renewal/applications.html",
}
BOT = "Mozilla/5.0 (compatible; BaseloadBot/1.0; +https://baseload-capacity-gap.vercel.app)"
PYBOT = f"python-requests/{requests.__version__} BaseloadBot/1.0 (+https://baseload-capacity-gap.vercel.app)"
HDRS = {"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9"}
variants = {"current-bot-ua": (BOT, {}), "python-default": (None, {}),
            "pybot-honest": (PYBOT, {}), "pybot+accept": (PYBOT, HDRS)}
N = 8
for ulabel, url in URLS.items():
    for name, (ua, extra) in variants.items():
        tally = collections.Counter()
        for i in range(N):
            s = requests.Session()
            if ua: s.headers["User-Agent"] = ua
            s.headers.update(extra)
            try: tally[s.get(url, timeout=60).status_code] += 1
            except Exception as e: tally["exc"] += 1
            time.sleep(2)
        print(f"{ulabel:8} {name:16} {dict(tally)}", flush=True)
