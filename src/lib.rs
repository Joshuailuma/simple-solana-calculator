// Import required Solana libraries
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::next_account_info, account_info::AccountInfo, entrypoint,
    entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey,
};

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct CalculatorAccount {
    pub result: u32,
}
// Define the program ID
entrypoint!(process_instruction);
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let account = next_account_info(accounts_iter)?;

    let instruction = CalculatorInstruction::unpack(instruction_data)?;

    if account.owner != program_id {
        msg!("Calculator account does not have the correct program id");
        return Err(ProgramError::IncorrectProgramId);
    } else {
        msg!("Calculator account has the correct program id");
    }

    match instruction {
        CalculatorInstruction::Add { num1, num2 } => {
            let result1 = add(num1, num2);
            let mut calculator_account = CalculatorAccount::try_from_slice(&account.data.borrow())?;
            calculator_account.result = result1;
            calculator_account.serialize(&mut &mut account.data.borrow_mut()[..])?;
            msg!("The result is: {}", result1);
        }
        CalculatorInstruction::Subtract { num1, num2 } => {
            let result2 = subtract(num1, num2);
            let mut calculator_account = CalculatorAccount::try_from_slice(&account.data.borrow())?;
            calculator_account.result = result2;
            calculator_account.serialize(&mut &mut account.data.borrow_mut()[..])?;
            msg!("The result is: {}", result2);
        }
    };

    Ok(())
}

pub enum CalculatorInstruction {
    Add { num1: u32, num2: u32 },
    Subtract { num1: u32, num2: u32 },
}

impl CalculatorInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&tag, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;

        if rest.len() != 8 {
            return Err(ProgramError::InvalidInstructionData);
        }

        Ok(match tag {
            0 => Self::Add {
                num1: Self::unpack_num1(rest)?,
                num2: Self::unpack_num2(rest)?,
            },
            1 => Self::Subtract {
                num1: Self::unpack_num1(rest)?,
                num2: Self::unpack_num2(rest)?,
            },

            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }

    fn unpack_num1(input: &[u8]) -> Result<u32, ProgramError> {
        let num1 = input
            .get(..4)
            .and_then(|slice| slice.try_into().ok())
            .map(u32::from_le_bytes)
            .ok_or(ProgramError::InvalidInstructionData)?;
        Ok(num1)
    }
    fn unpack_num2(input: &[u8]) -> Result<u32, ProgramError> {
        let num1 = input
            .get(4..8)
            .and_then(|slice| slice.try_into().ok())
            .map(u32::from_le_bytes)
            .ok_or(ProgramError::InvalidInstructionData)?;
        Ok(num1)
    }
}

fn add(num1: u32, num2: u32) -> u32 {
    num1 + num2
}

fn subtract(num1: u32, num2: u32) -> u32 {
    num1 - num2
}
