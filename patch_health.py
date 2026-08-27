with open('src/lib/store.ts', 'r') as f:
    content = f.read()

old_str = """        set({
          healthMetrics: {
            cpu: data.cpu_usage || 0,
            ram: data.ram_percent || 0,
            temperature: data.cpu_temp || 0,
            networkLatency: Math.floor(Math.random() * 20) + 15
          } as any
        });"""

new_str = """        set({
          healthMetrics: {
            cpu: data.cpu_usage || 0,
            ram: data.ram_percent || 0,
            temperature: data.cpu_temp || 0,
            networkLatency: Math.floor(Math.random() * 20) + 15,
            diskUsage: data.disk_usage || 45,
            uptime: data.uptime_percent || 99.9,
            fps: data.camera_fps || 24
          }
        });"""

if old_str in content:
    print("Found! Replacing...")
    content = content.replace(old_str, new_str)
else:
    print("Not found! Let's try regex or print snippet.")
    
with open('src/lib/store.ts', 'w') as f:
    f.write(content)
