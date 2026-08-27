import re

with open('src/components/sections/Analytics.tsx', 'r') as f:
    content = f.read()

# Replace: const actualVal = aiForecast.actual[aiForecast.actual.length - 1]?.perRoute?.[i] || 0;
# With safe fallback

safe_actualVal = """                const actualLast = aiForecast.actual.length > 0 ? aiForecast.actual[aiForecast.actual.length - 1] : null;
                const actualVal = actualLast?.perRoute?.[i] || 0;"""

content = re.sub(r'const actualVal = aiForecast\.actual\[aiForecast\.actual\.length - 1\]\?\.perRoute\?\.\[i\] \|\| 0;', safe_actualVal, content)

with open('src/components/sections/Analytics.tsx', 'w') as f:
    f.write(content)
