const fs = require('fs');
const path = require('path');
const fileHandlers = require('./file-handlers');

function getConfigPath() {
  const userDataPath = fileHandlers.getUserDataPath();
  return path.join(userDataPath, 'config.json');
}

function loadConfig() {
  try {
    const filePath = getConfigPath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
  return {};
}

function saveConfig(config) {
  try {
    const userDataPath = fileHandlers.getUserDataPath();
    const filePath = getConfigPath();
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save config:', error);
    return false;
  }
}

module.exports = {
  getConfigPath,
  loadConfig,
  saveConfig,
}; 