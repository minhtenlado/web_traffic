import re

with open('src/lib/constants.ts', 'r') as f:
    content = f.read()

urls = {
    "cam_01": "https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9dde1f766c880017188c98&camLocation=N%C3%BAt%20giao%20H%C3%A0ng%20Xanh%203%20(C%E1%BA%A7u%20Th%E1%BB%8B%20Ngh%C3%A8%20-%20H%C3%A0ng%20Xanh)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
    "cam_02": "https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9ddf0f766c880017188c9e&camLocation=N%C3%BAt%20giao%20H%C3%A0ng%20Xanh%206%20(C%E1%BA%A7u%20%C4%90i%E1%BB%87n%20Bi%C3%AAn%20Ph%E1%BB%A7%20-%20H%C3%A0ng%20Xanh)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
    "cam_03": "https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5a8253615058170011f6eabf&camLocation=%C4%90inh%20B%E1%BB%99%20L%C4%A9nh%20-%20B%E1%BA%A1ch%20%C4%90%E1%BA%B1ng%201&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
    "cam_04": "https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=66b1c426779f74001867415e&camLocation=%C4%90i%E1%BB%87n%20Bi%C3%AAn%20Ph%E1%BB%A7%20-%20Nguy%E1%BB%85n%20Gia%20Tr%C3%AD&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
    "cam_05": "https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9ddd49766c880017188c94&camLocation=N%C3%BAt%20giao%20H%C3%A0ng%20Xanh%201%20(Vi%E1%BB%87n%20M%C3%A1y%20t%C3%ADnh)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8"
}

for cam_id, new_url in urls.items():
    # Find the block for this camera and replace its url
    # We look for id: "cam_01", ... url: "..."
    pattern = r'(id:\s*"' + cam_id + r'".*?url:\s*")[^"]+(")'
    content = re.sub(pattern, r'\g<1>' + new_url + r'\g<2>', content, flags=re.DOTALL)

with open('src/lib/constants.ts', 'w') as f:
    f.write(content)
