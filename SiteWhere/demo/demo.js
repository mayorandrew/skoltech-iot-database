var mqtt = require('mqtt');

const mqttHost = "localhost";

// Device unique id
const hardwareId = "TEST_ID";

// Id of the device type (also called specification)
const specificationToken = "2410d511-ee7f-4878-a8cd-e9f46d9527c2";

// Optional id of the site device belongs to
// const siteToken = "";

// Constraints for random data generation
const minTemperature = 17.5, maxTemperature = 30, minHumidity = 12, maxHumidity = 90;

// Initialization of temperature and humidity data with random values
var data = {
    temperature: minTemperature + (maxTemperature - minTemperature) * Math.random() ,
    humidity: minHumidity + (maxHumidity - minHumidity) * Math.random()
};

// Flag which controls whether to send data to the server
var enabled = false;

// Interval object
var intervalId = null;

// Initialization of mqtt client
console.log('Connecting to: %s', mqttHost);
var client  = mqtt.connect('mqtt://'+ mqttHost);

// This function is called when client is connected to the server
client.on('connect', function () {
    console.log('Client connected!');

    // This line demonstrates security issue in the default configuration
    // Every client can listen to any message writte to the entire sitewhere installation
    // client.subscribe('SiteWhere/input/json');

    console.log('Registering device...');
    registerDevice();
});

// This function is called when the message from the server arrives
client.on('message', function(topic, message) {
    var processed = false;

    // Check if message is a system command
    if (topic == 'SiteWhere/system/' + hardwareId) {
        console.log('Received new command');
        try {
            var messageData = JSON.parse(message.toString());

            // Check if message is a registration confirmation
            if (messageData.systemCommand.type == 'RegistrationAck' &&
                messageData.systemCommand.reason == 'NewRegistration') {
                console.log('Device registered');

                processed = true;
                setEnabled(enabled);
            }

        } catch (e) {
            console.error(e);
        }
    }

    // Check if message is a custom device command
    if (topic == 'SiteWhere/commands/' + hardwareId) {
        console.log('Received new command');
        try {
            var messageData = JSON.parse(message.toString());
            var parameters = messageData.command.invocation.parameterValues;

            // Check if message is a "setEnabled" command
            if (messageData.command.command.name == 'setEnabled') {

                // Update device state
                setEnabled(parameters.enabled == 'true');

                // Return the response for the command
                client.publish('SiteWhere/input/json', JSON.stringify({
                    hardwareId: hardwareId,
                    type: 'Acknowledge',
                    request: {
                        response: enabled,
                        originatingEventId: messageData.command.invocation.id,
                        updateState: false,
                        eventDate: (new Date()).toISOString()
                    }
                }));

                processed = true;
            }
        } catch (e) {
            console.error(e);
        }
    }

    // If message is not processed then it is unknown
    if (!processed) {
        console.log('Received unknown command');
        console.log(topic);

        // Pretty-print the message data
        console.log(JSON.stringify(JSON.parse(message.toString()), null, 2));
    }
});

// Update the enabled flag
function setEnabled(newEnabled) {
    var oldEnabled = enabled;
    enabled = newEnabled;

    // Publish message to the server that device state is updated
    client.publish('SiteWhere/input/json', JSON.stringify({
        hardwareId: hardwareId,
        type: 'DeviceAlert',
        request: {
            type: enabled ? 'device.enabled' : 'device.disabled',
            level: 'Info',
            message: enabled ? 'Device enabled' : 'Device disabled',
            updateState: false,
            eventDate: (new Date()).toISOString()
        }
    }));

    console.log(enabled ? 'Device enabled' : 'Device disabled');

    // If device is enabled, start telemetry publication
    if (enabled && !oldEnabled) {
        startTelemetry();
    } else if (!enabled && oldEnabled) {
        stopTelemetry();
    }
}

// Schedules telemetry data upload once per second
function startTelemetry() {
    console.log('Uploading temperature and humidity data once per second...');
    intervalId = setInterval(publishTelemetry, 1000);
}

// Stops telemetry publication
function stopTelemetry() {
    clearInterval(intervalId);
}

// Registers device on a server
function registerDevice() {
	// Subscribe to the commands from the server
    client.subscribe('SiteWhere/system/' + hardwareId);
    client.subscribe('SiteWhere/commands/' + hardwareId);

    // Publish the confirmation message
    var message = {
        hardwareId: hardwareId,
        type: "RegisterDevice",
        request: {
            hardwareId: hardwareId,
            specificationToken: specificationToken,
            // siteToken: siteToken // optional
        }
    };

    console.log(message);
    client.publish('SiteWhere/input/json', JSON.stringify(message));
}

// Upload telemetry
function publishTelemetry() {
	// Generate new values
    data.temperature = genNextValue(data.temperature, minTemperature, maxTemperature);
    data.humidity = genNextValue(data.humidity, minHumidity, maxHumidity);

    // Publish the values
    var message = {
        hardwareId: hardwareId,
        type: "DeviceMeasurements",
        request: {
            measurements: data,
            updateState: true,
            eventDate: (new Date()).toISOString()
        }
    };

    console.log(message);
    client.publish('SiteWhere/input/json', JSON.stringify(message));
}

// Generates new random value that is within 3% range from previous value
function genNextValue(prevValue, min, max) {
    var value = prevValue + ((max - min) * (Math.random() - 0.5)) * 0.03;
    value = Math.max(min, Math.min(max, value));
    return Math.round(value * 10) / 10;
}

// Catches ctrl+c event
process.on('SIGINT', function () {
    console.log();
    console.log('Disconnecting...');
    client.end();
    console.log('Exited!');
    process.exit(2);
});

// Catches uncaught exceptions
process.on('uncaughtException', function(e) {
    console.log('Uncaught Exception...');
    console.log(e.stack);
    process.exit(99);
});
