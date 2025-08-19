// webpack.config.js
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

module.exports = {
  mode: "production",
  entry: {
    popup: "./src/popup.js",
    background: "./src/background.js",
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true, // Removes console.* statements
          },
        },
      }),
      new CssMinimizerPlugin(),
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css",
    }),
    new CopyPlugin({
      patterns: [
        {
          from: "./src/manifest.json",
          to: "manifest.json",
          transform(content) {
            // Remove comments and minify manifest
            return JSON.stringify(JSON.parse(content));
          },
        },
        {
          from: "./src/popup.html",
          to: "popup.html",
          transform(content) {
            // Minify HTML
            return content.toString().replace(/\s+/g, " ").trim();
          },
        },
        // Add ExtPay.js
        { from: "./src/ExtPay.js", to: "ExtPay.js" },
        // Add any icons or other assets
        { from: "./src/icons", to: "icons" },
      ],
    }),
  ],
};
