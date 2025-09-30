// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title NeftitNFT
 * @dev ERC721 NFT contract for NEFTIT platform with metadata URI support
 */
contract NeftitNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    
    // Mapping from token ID to rarity
    mapping(uint256 => string) public tokenRarity;
    
    // Events
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI, string rarity);
    
    constructor() ERC721("NEFTIT NFT", "NEFTIT") {}
    
    /**
     * @dev Mint a new NFT to the specified address
     * @param to The address to mint the NFT to
     * @param tokenURI The metadata URI for the NFT
     * @param rarity The rarity of the NFT (common, rare, platinum)
     */
    function mint(address to, string memory tokenURI, string memory rarity) public onlyOwner returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        tokenRarity[tokenId] = rarity;
        
        emit NFTMinted(to, tokenId, tokenURI, rarity);
        
        return tokenId;
    }
    
    /**
     * @dev Batch mint multiple NFTs to the same address
     * @param to The address to mint the NFTs to
     * @param tokenURIs Array of metadata URIs for the NFTs
     * @param rarities Array of rarities for the NFTs
     */
    function batchMint(
        address to, 
        string[] memory tokenURIs, 
        string[] memory rarities
    ) public onlyOwner returns (uint256[] memory) {
        require(tokenURIs.length == rarities.length, "Arrays length mismatch");
        
        uint256[] memory tokenIds = new uint256[](tokenURIs.length);
        
        for (uint256 i = 0; i < tokenURIs.length; i++) {
            uint256 tokenId = _tokenIdCounter.current();
            _tokenIdCounter.increment();
            
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, tokenURIs[i]);
            tokenRarity[tokenId] = rarities[i];
            
            tokenIds[i] = tokenId;
            emit NFTMinted(to, tokenId, tokenURIs[i], rarities[i]);
        }
        
        return tokenIds;
    }
    
    /**
     * @dev Get the current token ID counter
     */
    function getCurrentTokenId() public view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    /**
     * @dev Get the rarity of a token
     * @param tokenId The token ID to query
     */
    function getRarity(uint256 tokenId) public view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return tokenRarity[tokenId];
    }
    
    /**
     * @dev Get all tokens owned by an address
     * @param owner The address to query
     */
    function getTokensByOwner(address owner) public view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](tokenCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < _tokenIdCounter.current(); i++) {
            if (_exists(i) && ownerOf(i) == owner) {
                tokenIds[index] = i;
                index++;
            }
        }
        
        return tokenIds;
    }
    
    // Override required functions
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
