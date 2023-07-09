# Solana Calculator

This project contains a simple solana contract built with Rust that calculates the sum and difference of two numbers chosen by the user, it also contains a client built with Typescript that facilitates interaction with the contract.

# Getting Started
Have [Node](http://modejs.org), [Rust](https://www.rust-lang.org/tools/install) and [Solana](https://docs.solana.com/cli/install-solana-cli-tools) installed

### Running the program

- run `npm install` to install the dependencies
- `npm run build:program` to build the program
- `npm run deploy` to deploy the program on the devnet

### Interacting with the program
- `npm run start add -- num1 num2` to add two numbers. E.g `npm run start add -- 4 2` to add 2 to 4
- `npm run start subtract -- num1 num2` to subtract num2 from num1. E.g `npm run start subtract -- 4 2` to subtract 2 from 4.

## Author
Joshua Iluma