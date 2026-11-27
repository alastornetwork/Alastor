// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAlastorProofAnchor
 * @notice On-chain anchoring interface for ALASTOR Proof of Error SHA-256 digests and Merkle batches
 *         deployed on Robinhood Chain (Chain ID 4663).
 */
interface IAlastorProofAnchor {
    struct BatchCommitment {
        bytes32 merkleRoot;
        uint64 anchoredAt;
        uint32 proofCount;
        address relayer;
    }

    event ProofBatchAnchored(
        uint256 indexed batchId,
        bytes32 indexed merkleRoot,
        uint32 proofCount,
        address indexed relayer
    );

    event SingleProofAnchored(
        bytes32 indexed proofIdHash,
        bytes32 indexed contentSha256,
        address indexed relayer
    );

    function anchorBatch(bytes32 merkleRoot, uint32 proofCount) external returns (uint256 batchId);

    function anchorSingleProof(bytes32 proofIdHash, bytes32 contentSha256) external;

    function verifyProofInclusion(
        uint256 batchId,
        bytes32 contentSha256,
        bytes32[] calldata merkleProof
    ) external view returns (bool valid);
}
