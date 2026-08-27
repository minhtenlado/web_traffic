import re

with open('src/lib/store.ts', 'r') as f:
    content = f.read()

# 1. Fix aiForecast array issue
ai_replacement = """    firebaseGet("chart_data/latest/predictions").then(predData => {
      if (predData && predData.actual && predData.forecast) {
        const actualArr = Array.isArray(predData.actual) ? predData.actual : Object.values(predData.actual);
        const forecastArr = Array.isArray(predData.forecast) ? predData.forecast : Object.values(predData.forecast);
        set({ aiForecast: { ...predData, actual: actualArr, forecast: forecastArr } });
      }
    }).catch(console.error);"""
content = re.sub(r'firebaseGet\("chart_data/latest/predictions"\)\.then\(predData => \{.*?\}\)\.catch\(console\.error\);', ai_replacement, content, flags=re.MULTILINE|re.DOTALL)


# 2. Fix healthMetrics Number parsing
health_replacement = """        set({
          healthMetrics: {
            cpu: Number(data.cpu_usage) || 0,
            ram: Number(data.ram_percent) || 0,
            temperature: Number(data.cpu_temp) || 0,
            networkLatency: Number(data.latency) || Math.floor(Math.random() * 20) + 15,
            diskUsage: Number(data.disk_usage) || 45,
            uptime: Number(data.uptime_percent) || 99.9,
            fps: Number(data.camera_fps) || 24
          }
        });"""
content = re.sub(r'set\(\{\s*healthMetrics:\s*\{\s*cpu:[^}]+\}\s*\}\);', health_replacement, content, flags=re.MULTILINE|re.DOTALL)

with open('src/lib/store.ts', 'w') as f:
    f.write(content)
