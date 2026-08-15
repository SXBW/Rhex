import nextConfig from "eslint-config-next"

export default [
  ...nextConfig,
  {
    ignores: ["addons/**", "public/**", "eslint.config.mjs"],
  },
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]
