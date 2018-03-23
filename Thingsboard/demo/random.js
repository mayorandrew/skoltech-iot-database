var mqtt = require('mqtt');

// Don't forget to update accessToken constant with your device access token
const thingsboardHost = "176.112.194.104";
const accessToken = "RASPBERRY_PI_DEMO_TOKEN";
var min = 0, max = 5;

// Initialization of temperature and humidity data with random values
var data = {
    number: Math.floor(Math.random() * (max - min)) + min
};

// Initialization of mqtt client using Thingsboard host and device access token
console.log('Connecting to: %s using access token: %s', thingsboardHost, accessToken);
var client  = mqtt.connect('mqtt://'+ thingsboardHost, { username: accessToken });

// Triggers when client is successfully connected to the Thingsboard server
client.on('connect', function () {
    console.log('Client connected!');
    // Uploads firmware version and serial number as device attributes using 'v1/devices/me/attributes' MQTT topic
    client.publish('v1/devices/me/attributes', JSON.stringify({ current_min: min, current_max: max }));
    // Subscribe to attribute updates
    client.subscribe('v1/devices/me/attributes');
    client.subscribe('v1/devices/me/attributes/response/+');
    // Request attributes
    console.log('Requesting attributes');
    client.publish('v1/devices/me/attributes/request/1', JSON.stringify({ sharedKeys: "min,max" }));
    // Schedules telemetry data upload once per second
    console.log('Uploading random data once per second...');
    setInterval(publishTelemetry, 1000);
});

client.on('message', function(topic, message) {
    console.log('message.topic: ', topic);
    console.log('message.message: ', message.toString());


    var messageData = JSON.parse(message.toString());
    if (topic == 'v1/devices/me/attributes/response/1') {
        min = messageData.shared.min;
        max = messageData.shared.max;
        console.log('New min = ' + min + ' max = ' + max + '. Sending them to the server...');
        client.publish('v1/devices/me/attributes', JSON.stringify({ current_min: min, current_max: max }));
        console.log('Attributes sent');
    }

    if (topic == 'v1/devices/me/attributes') {
        if (messageData.max) {
            max = messageData.max;
        }
        if (messageData.min) {
            min = messageData.min;
        }
        console.log('New min = ' + min + ' max = ' + max + '. Sending them to the server...');
        client.publish('v1/devices/me/attributes', JSON.stringify({ current_min: min, current_max: max }));
        console.log('Attributes sent');
    }

});

// Uploads telemetry data using 'v1/devices/me/telemetry' MQTT topic
function publishTelemetry() {
    data.number = Math.floor(Math.random() * (max - min)) + min;
    client.publish('v1/devices/me/telemetry', JSON.stringify(data));
}

//Catches ctrl+c event
process.on('SIGINT', function () {
    console.log();
    console.log('Disconnecting...');
    client.end();
    console.log('Exited!');
    process.exit(2);
});

//Catches uncaught exceptions
process.on('uncaughtException', function(e) {
    console.log('Uncaught Exception...');
    console.log(e.stack);
    process.exit(99);
});
