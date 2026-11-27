// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title AlastorOperatorStaking
 * @notice Collateral vault for external HUNTER and JUDGE operators in Phase 3 of the ALASTOR Roadmap.
 *         Enforces minimum role bonds, unbonding cooldowns, and deterministic slashing hooks.
 */
contract AlastorOperatorStaking {
    enum AgentRole {
        None,
        Hunter,
        Judge
    }

    struct OperatorPosition {
        AgentRole role;
        uint128 activeStake;
        uint128 pendingUnbond;
        uint64 unbondAvailableAt;
        bool disputed;
    }

    error Unauthorized();
    error InsufficientBond();
    error CooldownActive();
    error OperatorDisputed();
    error TransferFailed();

    IERC20Minimal public immutable stakingToken;
    address public governance;
    address public slashingCourt;
    uint64 public immutable unbondingPeriodSeconds;
    uint128 public minHunterBond;
    uint128 public minJudgeBond;

    mapping(address => OperatorPosition) public operators;

    event OperatorRegistered(address indexed operator, AgentRole role, uint128 stakeAmount);
    event UnbondInitiated(address indexed operator, uint128 amount, uint64 availableAt);
    event UnbondWithdrawn(address indexed operator, uint128 amount);
    event OperatorSlashed(address indexed operator, uint128 amount, bytes32 indexed evidenceHash);

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Unauthorized();
        _;
    }

    modifier onlySlashingCourt() {
        if (msg.sender != slashingCourt) revert Unauthorized();
        _;
    }

    constructor(
        IERC20Minimal token,
        address initialGovernance,
        address initialCourt,
        uint64 cooldownSeconds,
        uint128 hunterBond,
        uint128 judgeBond
    ) {
        stakingToken = token;
        governance = initialGovernance;
        slashingCourt = initialCourt;
        unbondingPeriodSeconds = cooldownSeconds;
        minHunterBond = hunterBond;
        minJudgeBond = judgeBond;
    }

    function stakeAndRegister(AgentRole role, uint128 amount) external {
        if (role == AgentRole.None) revert InsufficientBond();
        OperatorPosition storage pos = operators[msg.sender];
        uint128 nextStake = pos.activeStake + amount;

        uint128 required = role == AgentRole.Judge ? minJudgeBond : minHunterBond;
        if (nextStake < required) revert InsufficientBond();

        if (!stakingToken.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        pos.role = role;
        pos.activeStake = nextStake;
        emit OperatorRegistered(msg.sender, role, nextStake);
    }

    function requestUnbond(uint128 amount) external {
        OperatorPosition storage pos = operators[msg.sender];
        if (pos.disputed) revert OperatorDisputed();
        if (amount == 0 || amount > pos.activeStake) revert InsufficientBond();

        pos.activeStake -= amount;
        pos.pendingUnbond += amount;
        pos.unbondAvailableAt = uint64(block.timestamp) + unbondingPeriodSeconds;

        emit UnbondInitiated(msg.sender, amount, pos.unbondAvailableAt);
    }

    function completeUnbond() external {
        OperatorPosition storage pos = operators[msg.sender];
        if (pos.disputed) revert OperatorDisputed();
        if (pos.pendingUnbond == 0 || block.timestamp < pos.unbondAvailableAt) revert CooldownActive();

        uint128 payout = pos.pendingUnbond;
        pos.pendingUnbond = 0;

        if (!stakingToken.transfer(msg.sender, payout)) revert TransferFailed();
        emit UnbondWithdrawn(msg.sender, payout);
    }

    function slashOperator(address operator, uint128 slashAmount, address recipient, bytes32 evidenceHash)
        external
        onlySlashingCourt
    {
        OperatorPosition storage pos = operators[operator];
        uint128 fromActive = slashAmount <= pos.activeStake ? slashAmount : pos.activeStake;
        pos.activeStake -= fromActive;

        uint128 remainder = slashAmount - fromActive;
        uint128 fromPending = remainder <= pos.pendingUnbond ? remainder : pos.pendingUnbond;
        pos.pendingUnbond -= fromPending;

        uint128 totalSlashed = fromActive + fromPending;
        if (totalSlashed > 0) {
            if (!stakingToken.transfer(recipient, totalSlashed)) revert TransferFailed();
        }
        emit OperatorSlashed(operator, totalSlashed, evidenceHash);
    }
}
