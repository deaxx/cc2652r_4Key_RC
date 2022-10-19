const zigbeeHerdsmanConverters = require('zigbee-herdsman-converters');

const exposes = zigbeeHerdsmanConverters.exposes;
const ea = exposes.access;
const e = exposes.presets;
const fz = zigbeeHerdsmanConverters.fromZigbeeConverters;
const tz = zigbeeHerdsmanConverters.toZigbeeConverters;

const ptvo_switch = zigbeeHerdsmanConverters.findByDevice({modelID: 'ptvo.switch'});
fz.legacy = ptvo_switch.meta.tuyaThermostatPreset;
fz.ptvo_on_off = {
  cluster: 'genOnOff',
  type: ['attributeReport', 'readResponse'],
  convert: (model, msg, publish, options, meta) => {
      if (msg.data.hasOwnProperty('onOff')) {
          const channel = msg.endpoint.ID;
          const endpointName = `l${channel}`;
          const binaryEndpoint = model.meta && model.meta.binaryEndpoints && model.meta.binaryEndpoints[endpointName];
          const prefix = (binaryEndpoint) ? model.meta.binaryEndpoints[endpointName] : 'state';
          const property = `${prefix}_${endpointName}`;
	  if (binaryEndpoint) {
            return {[property]: msg.data['onOff'] === 1};
          }
          return {[property]: msg.data['onOff'] === 1 ? 'ON' : 'OFF'};
      }
  },
};

const switchTypesList = {
    'switch': 0x00,
    'single click': 0x01,
    'multi-click': 0x02,
    'reset to defaults': 0xff,
};

const switchActionsList = {
    on: 0x00,
    off: 0x01,
    toggle: 0x02,
};

const inputLinkList = {
    no: 0x00,
    yes: 0x01,
};

const bindCommandList = {
    'on/off': 0x00,
    'toggle': 0x01,
    'change level up': 0x02,
    'change level down': 0x03,
    'change level up with off': 0x04,
    'change level down with off': 0x05,
    'recall scene 0': 0x06,
    'recall scene 1': 0x07,
    'recall scene 2': 0x08,
    'recall scene 3': 0x09,
    'recall scene 4': 0x0A,
    'recall scene 5': 0x0B,
};

function getSortedList(source) {
    const keysSorted = [];
    for (const key in source) {
        keysSorted.push([key, source[key]]);
    }

    keysSorted.sort(function(a, b) {
        return a[1] - b[1];
    });

    const result = [];
    keysSorted.forEach((item) => {
        result.push(item[0]);
    });
    return result;
}

function getListValueByKey(source, value) {
    const intVal = parseInt(value, 10);
    return source.hasOwnProperty(value) ? source[value] : intVal;
}

const getKey = (object, value) => {
    for (const key in object) {
        if (object[key] == value) return key;
    }
};

tz.ptvo_on_off_config = {
    key: ['switch_type', 'switch_actions', 'link_to_output', 'bind_command'],
    convertGet: async (entity, key, meta) => {
        await entity.read('genOnOffSwitchCfg', ['switchType', 'switchActions', 0x4001, 0x4002]);
    },
    convertSet: async (entity, key, value, meta) => {
        let payload;
        let data;
        switch (key) {
        case 'switch_type':
            data = getListValueByKey(switchTypesList, value);
            payload = {switchType: data};
            break;
        case 'switch_actions':
            data = getListValueByKey(switchActionsList, value);
            payload = {switchActions: data};
            break;
        case 'link_to_output':
            data = getListValueByKey(inputLinkList, value);
            payload = {0x4001: {value: data, type: 32 /* uint8 */}};
            break;
        case 'bind_command':
            data = getListValueByKey(bindCommandList, value);
            payload = {0x4002: {value: data, type: 32 /* uint8 */}};
            break;
        }
        await entity.write('genOnOffSwitchCfg', payload);
    },
};

fz.ptvo_on_off_config = {
    cluster: 'genOnOffSwitchCfg',
    type: ['readResponse', 'attributeReport'],
    convert: (model, msg, publish, options, meta) => {
        const channel = getKey(model.endpoint(msg.device), msg.endpoint.ID);
        const {switchActions, switchType} = msg.data;
        const inputLink = msg.data[0x4001];
        const bindCommand = msg.data[0x4002];
        return {
            [`switch_type_${channel}`]: getKey(switchTypesList, switchType),
            [`switch_actions_${channel}`]: getKey(switchActionsList, switchActions),
            [`link_to_output_${channel}`]: getKey(inputLinkList, inputLink),
            [`bind_command_${channel}`]: getKey(bindCommandList, bindCommand),
        };
    },
};

function ptvo_on_off_config_exposes(epName) {
    const features = [];
    features.push(exposes.enum('switch_type', exposes.access.ALL,
        getSortedList(switchTypesList)).withEndpoint(epName));
    features.push(exposes.enum('switch_actions', exposes.access.ALL,
        getSortedList(switchActionsList)).withEndpoint(epName));
    features.push(exposes.enum('link_to_output', exposes.access.ALL,
        getSortedList(inputLinkList)).withEndpoint(epName));
    features.push(exposes.enum('bind_command', exposes.access.ALL,
        getSortedList(bindCommandList)).withEndpoint(epName));
    return features;
}



const device = {
    zigbeeModel: ['ptvo.rc4'],
    model: 'ptvo.rc4',
    vendor: 'ptvo.rc4',
    description: '[Configurable firmware](https://ptvo.info/zigbee-configurable-firmware-features/)',
    fromZigbee: [fz.ignore_basic_report, fz.battery, fz.ptvo_switch_analog_input, fz.ptvo_multistate_action, fz.legacy.ptvo_switch_buttons,],
    toZigbee: [tz.ptvo_switch_trigger, tz.ptvo_switch_analog_input,],
    exposes: [e.battery(),
      e.voltage().withAccess(ea.STATE).withEndpoint('l6'),
      exposes.numeric('l7', ea.STATE).withDescription('Uptime (seconds)'),
      exposes.numeric('l8', ea.ALL).withDescription('Signal strength level (0..20)'),
      e.action(['single', 'double', 'triple', 'hold', 'release']),
      e.battery_voltage(),
],
    meta: {
        multiEndpoint: true,
        
    },
    endpoint: (device) => {
        return {
            l6: 6, l7: 7, l8: 8, l1: 1, l2: 2, l3: 3, l4: 4,
        };
    },
    icon: 'data:image/png;base64,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',
};

module.exports = device;
