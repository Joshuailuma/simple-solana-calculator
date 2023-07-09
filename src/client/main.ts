/**
 * Calculator Contract
 */

import {
  establishConnection,
  establishPayer,
  checkProgram,
  calculate,
  displayResult,
} from "./calculator";

async function main() {
  let operation;
  let num1;
  let num2;

  if (process.argv.length !== 5) {
    throw new Error("Invalid input.");
  }

  // Get the arguments
  process.argv.forEach(function (val, index, array) {
    switch (index) {
      case 2: {
        operation = val; // operator
      }
      case 3: {
        num1 = parseInt(val); // first num
      }
      case 4: {
        num2 = parseInt(val); // second num
      }
    }
  });

  if (!operation || !num1 || !num2) {
    throw new Error("Invalid input.");
  }

  // Establish connection to the cluster
  await establishConnection();

  // Determine who pays for the fees
  await establishPayer();

  // Check if the program has been deployed
  await checkProgram();

  // call calculator program
  await calculate(operation, num1, num2);

  // Find out the result
  await displayResult(operation, num1, num2);
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  }
);