import re

with open('src/lib/store.ts', 'r') as f:
    content = f.read()

# For predictions: Let's just make it robust. If predData has 'actual' and 'forecast', use it, otherwise ignore.
pred_replacement = """    firebaseGet("chart_data/latest/predictions").then(predData => {
      if (predData && predData.actual && predData.forecast) {
        set({ aiForecast: predData });
      }
    }).catch(console.error);"""

content = re.sub(r'firebaseGet\("chart_data/latest/predictions"\)\.then\(predData => \{.*?(?=\s*firebaseListen\("realtime"\s*,)', pred_replacement + "\n\n", content, flags=re.MULTILINE|re.DOTALL)

with open('src/lib/store.ts', 'w') as f:
    f.write(content)
