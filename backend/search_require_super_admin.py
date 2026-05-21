import os, re, sys
root = r'D:\eyerrems-desktop-deployed\Eyerrems-desktop\backend'
pattern = re.compile(r'require_super_admin')
for dirpath, _, filenames in os.walk(root):
    for f in filenames:
        if f.endswith('.py'):
            path = os.path.join(dirpath, f)
            try:
                with open(path, 'r', encoding='utf-8') as file:
                    for i, line in enumerate(file, 1):
                        if pattern.search(line):
                            print(f"{path}:{i}:{line.strip()}")
            except Exception:
                continue
