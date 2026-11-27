// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAlastorProofAnchor} from "./interfaces/IAlastorProofAnchor.sol";

/**
 * @title AlastorProofAnchor
 * @notice Anchors canonical RFC 8785 + SHA-256 Proof of Error digests and sorted-pair Merkle roots
 *         on Robinhood Chain (4663) for trust-minimized third-party auditability.
 */
contract AlastorProofAnchor is IAlastorProofAnchor {
    error Unauthorized();
    error InvalidRoot();
    error EmptyBatch();
    error DuplicateProof();

    uint256 public constant TARGET_CHAIN_ID = 4663;

    address public governance;
    uint256 public nextBatchId = 1;

    mapping(address => bool) public authorizedRelayers;
    mapping(uint256 => BatchCommitment) public batches;
    mapping(bytes32 => bytes32) public directProofDigests;

    event GovernanceTransferred(address indexed previousGovernance, address indexed nextGovernance);
    event RelayerUpdated(address indexed relayer, bool authorized);

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Unauthorized();
        _;
    }

    modifier onlyRelayer() {
        if (!authorizedRelayers[msg.sender] && msg.sender != governance) revert Unauthorized();
        _;
    }

    constructor(address initialGovernance) {
        if (initialGovernance == address(0)) revert Unauthorized();
        governance = initialGovernance;
        authorizedRelayers[initialGovernance] = true;
    }

    function setRelayer(address relayer, bool authorized) external onlyGovernance {
        authorizedRelayers[relayer] = authorized;
        emit RelayerUpdated(relayer, authorized);
    }

    function transferGovernance(address nextGovernance) external onlyGovernance {
        if (nextGovernance == address(0)) revert Unauthorized();
        address prev = governance;
        governance = nextGovernance;
        emit GovernanceTransferred(prev, nextGovernance);
    }

    /// @inheritdoc IAlastorProofAnchor
    function anchorBatch(bytes32 merkleRoot, uint32 proofCount) external onlyRelayer returns (uint256 batchId) {
        if (merkleRoot == bytes32(0)) revert InvalidRoot();
        if (proofCount == 0) revert EmptyBatch();

        batchId = nextBatchId++;
        batches[batchId] = BatchCommitment({
            merkleRoot: merkleRoot,
            anchoredAt: uint64(block.timestamp),
            proofCount: proofCount,
            relayer: msg.sender
        });

        emit ProofBatchAnchored(batchId, merkleRoot, proofCount, msg.sender);
    }

    /// @inheritdoc IAlastorProofAnchor
    function anchorSingleProof(bytes32 proofIdHash, bytes32 contentSha256) external onlyRelayer {
        if (contentSha256 == bytes32(0)) revert InvalidRoot();
        if (directProofDigests[proofIdHash] != bytes32(0)) revert DuplicateProof();

        directProofDigests[proofIdHash] = contentSha256;
        emit SingleProofAnchored(proofIdHash, contentSha256, msg.sender);
    }

    /// @inheritdoc IAlastorProofAnchor
    function verifyProofInclusion(
        uint256 batchId,
        bytes32 contentSha256,
        bytes32[] calldata merkleProof
    ) external view returns (bool valid) {
        bytes32 root = batches[batchId].merkleRoot;
        if (root == bytes32(0) || contentSha256 == bytes32(0)) return false;

        bytes32 computed = contentSha256;
        uint256 length = merkleProof.length;
        for (uint256 i = 0; i < length; ) {
            bytes32 sibling = merkleProof[i];
            computed = computed <= sibling
                ? keccak256(abi.encodePacked(computed, sibling))
                : keccak256(abi.encodePacked(sibling, computed));
            unchecked {
                ++i;
            }
        }
        return computed == root;
    }
}
