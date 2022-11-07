// eslint-disable-next-line no-undef
module.exports = {
  extends: ["../eslint-config-custom/index.js"],
  env: {
    node: true,
    es6: true
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  overrides: [
    {
      files: ["**/__tests__/**/*"],
      env: {
        jest: true,
      },
    },
  ],
};
