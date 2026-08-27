import re

with open('src/lib/store.ts', 'r') as f:
    content = f.read()

# Fix healthMetrics fallback
health_replacement = """        set({
          healthMetrics: {
            cpu: data.cpu_usage || 0,
            ram: data.ram_percent || 0,
            temperature: data.cpu_temp || 0,
            networkLatency: data.latency || Math.floor(Math.random() * 20) + 15,
            diskUsage: data.disk_usage || 45,
            uptime: data.uptime_percent || 99.9,
            fps: data.camera_fps || 24
          }
        });"""
content = re.sub(r'set\(\{\s*healthMetrics:\s*\{\s*cpu:[^}]+\}\s*as\s*any\s*\}\);', health_replacement, content, flags=re.MULTILINE|re.DOTALL)

# Fix aiForecast fallback
forecast_replacement = """    firebaseGet("chart_data/latest/predictions").then(predData => {
      if (predData) {
        set({ aiForecast: predData });
      }
    });"""
content = re.sub(r'firebaseGet\("chart_data/latest/predictions"\)\.then\(predData => \{\s*if \(predData\) set\(\{ aiForecast: predData \}\);\s*\}\);', forecast_replacement, content, flags=re.MULTILINE|re.DOTALL)

# Let's ensure I didn't break anything. Actually, wait. If predData is null, we do nothing (keep mock).
# What if it's already using if (predData) set(...) ?
# Let's check the current code for aiForecast.
