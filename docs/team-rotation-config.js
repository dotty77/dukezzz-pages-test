export {ROTATION_EXAMPLE_IDS, rotationConfiguration, rotationPreset, rotationBuild};
const ROTATION_EXAMPLE_IDS = Object.freeze(['1581','1641','1561']);
function rotationConfiguration(raw, knowledge) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!object(raw) || !object(raw.characters) || Object.keys(raw.characters).length > 62) return null;
  const result = {characters:{},keyBindings:{},focusAgentId:'',strategy:'auto'};
  for (const [id, item] of Object.entries(raw.characters)) {
    if (!Object.hasOwn(knowledge.agents,id) || !object(item) || !Number.isInteger(item.mindscape) || item.mindscape < 0 || item.mindscape > 6 || !Number.isInteger(item.signature) || item.signature < 0 || item.signature > 5) return null;
    const potential=item.potential === undefined ? 0 : item.potential;
    if (!Number.isInteger(potential) || potential < 0 || potential > 6) return null;
    const supported=knowledge.agents[id].potentialLevels;
    result.characters[id] = {mindscape:item.mindscape,signature:item.signature,potential:potential>0&&Array.isArray(supported)&&supported.includes(potential)?potential:0};
  }
  if (raw.strategy !== undefined && !['auto','steady','burst'].includes(raw.strategy)) return null;
  result.strategy = raw.strategy || 'auto';
  if (raw.focusAgentId != null && raw.focusAgentId !== '') {
    if (typeof raw.focusAgentId !== 'string' || !Object.hasOwn(knowledge.agents,raw.focusAgentId)) return null;
    result.focusAgentId = raw.focusAgentId;
  }
  if (raw.keyBindings !== undefined) {
    if (!object(raw.keyBindings) || Object.keys(raw.keyBindings).length > 192) return null;
    for (const [id,label] of Object.entries(raw.keyBindings)) {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) || typeof label !== 'string' || label.length > 32 || /[\u0000-\u001f\u007f]/.test(label)) return null;
      result.keyBindings[id] = label;
    }
  }
  return result;
}
function rotationPreset(kind='personal', knowledge) {
  const characters = Object.fromEntries(Object.keys(knowledge.agents).map(id=>[id,{mindscape:0,signature:0,potential:0}]));
  if (kind === 'personal') {
    characters['1581']={mindscape:6,signature:5};
    characters['1641']={mindscape:2,signature:1};
    characters['1561']={mindscape:2,signature:1};
  }
  return rotationConfiguration({characters,keyBindings:{},strategy:'auto',focusAgentId:''},knowledge);
}
function rotationBuild(config,id) {return {mindscape:0,signature:0,potential:0,...config.characters[id]};}
