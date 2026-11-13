# Builds the deployable folder from the claude.ai app (../index.html) and the public site (../website/index.html).
import os,shutil,re
here=os.path.dirname(os.path.abspath(__file__));root=os.path.dirname(here);pkg=os.path.join(root,'huda-website-package');out=os.path.join(pkg,'site')
shutil.rmtree(pkg,ignore_errors=True);shutil.rmtree(os.path.join(root,'deploy'),ignore_errors=True);os.makedirs(os.path.join(out,'system'))
app=open(os.path.join(root,'index.html'),encoding='utf-8').read()
V='10.12.2'
inject=('<script src="https://www.gstatic.com/firebasejs/%s/firebase-app-compat.js"></script>\n'
        '<script src="https://www.gstatic.com/firebasejs/%s/firebase-auth-compat.js"></script>\n'
        '<script src="https://www.gstatic.com/firebasejs/%s/firebase-firestore-compat.js"></script>\n'
        '<script src="firebase-config.js"></script>\n<script src="firebase-shim.js"></script>\n')%(V,V,V)
assert app.count('<script>\n"use strict";')==1
app=app.replace('<script>\n"use strict";',inject+'<script>\n"use strict";',1)
if not app.lstrip().lower().startswith('<!doctype'):
    app='<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="robots" content="noindex,nofollow">\n</head>\n<body>\n'+app+'\n</body>\n</html>\n'
open(os.path.join(out,'system','index.html'),'w',encoding='utf-8').write(app)
for f in ('firebase-shim.js','firebase-config.js','app-login.html'):shutil.copy(os.path.join(here,f),os.path.join(out,'system',f))
shutil.copy(os.path.join(root,'website','index.html'),os.path.join(out,'index.html'))
shutil.copy(os.path.join(here,'firestore.rules'),os.path.join(pkg,'firestore.rules'))
shutil.copy(os.path.join(here,'guide.md'),os.path.join(pkg,'دليل-التشغيل.md'))
open(os.path.join(out,'robots.txt'),'w').write('User-agent: *\nDisallow: /system/\n')
shutil.make_archive(pkg,'zip',root_dir=root,base_dir='huda-website-package')
print('built',pkg)
