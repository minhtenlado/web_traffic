import re

with open('src/lib/store.ts', 'r') as f:
    content = f.read()

# 1. Fix aiForecast array issue
ai_replacement = """    firebaseGet("chart_data/latest/predictions").then(predData => {
      if (predData && predData.actual && predData.forecast) {
        const actualArr = Array.isArray(predData.actual) ? predData.actual : Object.values(predData.actual);
        const forecastArr = Array.isArray(predData.forecast) ? predData.forecast : Object.values(predData.forecast);
        const directionsArr = Array.isArray(predData.directions) ? predData.directions : (predData.directions ? Object.values(predData.directions) : ["H1", "H2", "H3", "H4"]);
        set({ aiForecast: { ...predData, actual: actualArr, forecast: forecastArr, directions: directionsArr } });
      }
    }).catch(console.error);"""
content = re.sub(r'firebaseGet\("chart_data/latest/predictions"\)\.then\(predData => \{.*?\}\)\.catch\(console\.error\);', ai_replacement, content, flags=re.MULTILINE|re.DOTALL)

with open('src/lib/store.ts', 'w') as f:
    f.write(content)
