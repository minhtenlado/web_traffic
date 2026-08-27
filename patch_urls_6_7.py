import re

with open('src/lib/constants.ts', 'r') as f:
    content = f.read()

urls = {
    "cam_06": "https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9ddf49766c880017188ca0&camLocation=N%C3%BAt%20giao%20H%C3%A0ng%20Xanh%207%20(H%C3%A0ng%20Xanh%20-%20C%E1%BA%A7u%20V%C4%83n%20Th%C3%A1nh)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
    "cam_07": "https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9ddec9766c880017188c9c&camLocation=N%C3%BAt%20giao%20H%C3%A0ng%20Xanh%205%20(H%C3%A0ng%20Xanh%20-%20B%E1%BA%A1ch%20%C4%90%E1%BA%B1ng)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8"
}

for cam_id, new_url in urls.items():
    # Find the block for this camera and replace its url
    # We look for id: "cam_06", ... url: "..."
    pattern = r'(id:\s*"' + cam_id + r'".*?url:\s*")[^"]+(")'
    content = re.sub(pattern, r'\g<1>' + new_url + r'\g<2>', content, flags=re.DOTALL)

with open('src/lib/constants.ts', 'w') as f:
    f.write(content)
