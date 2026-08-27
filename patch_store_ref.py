import re

with open('src/lib/store.ts', 'r') as f:
    content = f.read()

# I will modify the loop in buildRouteStats
old_loop = """  for (const [camId, camData] of Object.entries(realtimeData)) {
    const routeId = CAM_TO_ROUTE[camId];
    if (!routeId) continue;
    if (!routeAcc[routeId]) routeAcc[routeId] = { totalCount: 0, labels: [], timestamps: [] };
    routeAcc[routeId].totalCount += camData.count || 0;
    if (camData.mapped_label) routeAcc[routeId].labels.push(camData.mapped_label);
    if (camData.timestamp) routeAcc[routeId].timestamps.push(camData.timestamp);
  }"""

new_loop = """  for (const [camId, camData] of Object.entries(realtimeData)) {
    // Exclude reference cameras from traffic calculations
    if (['cam_05', 'cam_06', 'cam_07'].includes(camId)) continue;
    
    const routeId = CAM_TO_ROUTE[camId];
    if (!routeId) continue;
    if (!routeAcc[routeId]) routeAcc[routeId] = { totalCount: 0, labels: [], timestamps: [] };
    routeAcc[routeId].totalCount += camData.count || 0;
    if (camData.mapped_label) routeAcc[routeId].labels.push(camData.mapped_label);
    if (camData.timestamp) routeAcc[routeId].timestamps.push(camData.timestamp);
  }"""

content = content.replace(old_loop, new_loop)

# Also update the aiForecast generation to use only 4 cameras
# Wait, aiForecast is from Firebase now. But chartPoint adds them:
chart_point_old = "CAMERAS.slice(0, 4).forEach((c) => {"
chart_point_new = "CAMERAS.filter(c => !['cam_05', 'cam_06', 'cam_07'].includes(c.id)).forEach((c) => {"
content = content.replace(chart_point_old, chart_point_new)

with open('src/lib/store.ts', 'w') as f:
    f.write(content)
