const WebSocket = require('ws');
const uniqid = require('uniqid');

// Fill in your endpoint and token
const apiEndpoint = 'gcs.hybrid-xxxxxxxxxxx.herotech8-cloud.com'; // Fill in your hybrid server address here
const endpoint = 'wss://'+apiEndpoint+'/api/ws/client';
const token = ''; // Your generated API token (see usage guide)

// Fill in your chosen hybrid server & drone serial numbers
const hybridSerialNumber = 'HB1X-XXXX-XXXX';
const droneSerialNumber = 'DR1X-XXXX-XXXX';

// Interact with the WebSocket API to launch the drone
const requestId = uniqid();
var processId = null;

console.log('Connecting to WebSocket endpoint');

const ws = new WebSocket(endpoint, {
  rejectUnauthorized: false
});

ws.on('open', function open() {
  console.log('Connection opened to WebSocket');

  console.log('Sending identification message');

  ws.send(JSON.stringify({
    method: 'identify',
    token: token
  }));
});

ws.on('message', function message(data) {
  console.log('-----');
  console.log('Received: %s', data);

  if (data == 'Client Setup') {
    console.log('Client Setup');

    console.log('Subscribing to launch response');

    ws.send(JSON.stringify({
      method: 'subscribe',
      topic: 'hybrid/' + hybridSerialNumber + '/launch/response/' + requestId
    }));

    console.log('Publishing launch request');

    ws.send(JSON.stringify({
      method: 'publish',
      topic: 'hybrid/' + hybridSerialNumber + '/launch/request/' + requestId,
      message: {
        drone: droneSerialNumber
      }
    }));

    return;
  }

  try {
    data = JSON.parse(data);
  } catch(err) {
    console.log('Error parsing JSON data');

    return;
  }

  if (data.method == 'message') {
    if (data.topic == 'hybrid/' + hybridSerialNumber + '/launch/response/' + requestId) {
      console.log('Received launch response, process ID: ' + data.message.id);

      processId = data.message.id;

      console.log('Subscribing to action updates');

      ws.send(JSON.stringify({
        method: 'subscribe',
        topic: 'hybrid/' + hybridSerialNumber + '/launch/action/' + processId
      }));

      console.log('Subscribing to error updates');

      ws.send(JSON.stringify({
        method: 'subscribe',
        topic: 'hybrid/' + hybridSerialNumber + '/launch/error/' + processId
      }));

      setInterval(() => {
        ws.send(JSON.stringify({
          method: 'publish',
          topic: 'hybrid/' + hybridSerialNumber + '/launch/keepalive/' + processId,
          message: new Date().getTime()
        }));
      }, 5000);
    } else if (data.topic == 'hybrid/' + hybridSerialNumber + '/launch/action/' + processId) {
      console.log('Received launch action: ' + data.message);

      if (data.message == 'PRECHECK.OPERATOR_CONFIRM') {
        console.log('Confirming continue to PRECHECK');

        ws.send(JSON.stringify({
          method: 'publish',
          topic: 'hybrid/' + hybridSerialNumber + '/launch/confirm/' + processId,
          message: 'PRECHECK'
        }));
      } else if (data.message == 'PRELAUNCH.OPERATOR_CONFIRM') {
        console.log('Confirming continue to PRELAUNCH');

        ws.send(JSON.stringify({
          method: 'publish',
          topic: 'hybrid/' + hybridSerialNumber + '/launch/confirm/' + processId,
          message: 'PRELAUNCH'
        }));
      } else if (data.message == 'LAUNCH.OPERATOR_CONFIRM') {
        console.log('Confirming continue to LAUNCH');

        ws.send(JSON.stringify({
          method: 'publish',
          topic: 'hybrid/' + hybridSerialNumber + '/launch/confirm/' + processId,
          message: 'LAUNCH'
        }));
      } else if (data.message == 'LAUNCH.FINISHED') {
        console.log('Launch has finished');

        process.exit();
      } else if (data.message == 'CANCEL.FINISHED') {
        console.log('Launch has been cancelled');

        process.exit();
      }
    } else if (data.topic == 'hybrid/' + hybridSerialNumber + '/launch/error/' + processId) {
      console.log('Received launch error: ' + data.message.message + ' ' + data.message.action);
    }
  }
});
