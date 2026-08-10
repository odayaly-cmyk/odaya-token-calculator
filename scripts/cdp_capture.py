import base64, json, sys, time, urllib.request
import websocket

width, height, output = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
req = urllib.request.Request('http://127.0.0.1:9333/json/new?http://127.0.0.1:4173/token/', method='PUT')
target = json.load(urllib.request.urlopen(req))
ws = websocket.create_connection(target['webSocketDebuggerUrl'], origin='http://127.0.0.1:9333')
next_id = 0

def call(method, params=None):
    global next_id
    next_id += 1
    ws.send(json.dumps({'id': next_id, 'method': method, 'params': params or {}}))
    while True:
        message = json.loads(ws.recv())
        if message.get('id') == next_id:
            if 'error' in message: raise RuntimeError(message['error'])
            return message.get('result', {})

call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': True})
call('Page.enable')
call('Page.navigate', {'url': 'http://127.0.0.1:4173/token/'})
time.sleep(1)
metrics = call('Runtime.evaluate', {'expression': "JSON.stringify({innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,cost:document.querySelector('#primary-cost').textContent})", 'returnByValue': True})
shot = call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False, 'fromSurface': True})
with open(output, 'wb') as handle: handle.write(base64.b64decode(shot['data']))
print(metrics['result']['value'])
ws.close()
