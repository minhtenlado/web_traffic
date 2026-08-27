import re

with open('src/lib/constants.ts', 'r') as f:
    content = f.read()

# Add isReference: true to cam_05, cam_06, cam_07
for cam in ["cam_05", "cam_06", "cam_07"]:
    pattern = r'(id:\s*"' + cam + r'".*?position:\s*\{.*?\},\s*)'
    content = re.sub(pattern, r'\g<1>isReference: true,\n    ', content, flags=re.DOTALL)

with open('src/lib/constants.ts', 'w') as f:
    f.write(content)
