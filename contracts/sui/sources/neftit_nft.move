module neftit::neftit_nft {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};
    use sui::url::{Self, Url};
    use sui::event;

    /// The NEFTIT NFT object
    struct NeftitNFT has key, store {
        id: UID,
        name: String,
        description: String,
        image_url: Url,
        rarity: String,
        creator: address,
    }

    /// Event emitted when an NFT is minted
    struct NFTMinted has copy, drop {
        object_id: address,
        name: String,
        recipient: address,
        rarity: String,
    }

    /// Capability for minting NFTs (admin only)
    struct MintCap has key {
        id: UID,
    }

    /// Initialize the module and create mint capability
    fun init(ctx: &mut TxContext) {
        let mint_cap = MintCap {
            id: object::new(ctx),
        };
        transfer::transfer(mint_cap, tx_context::sender(ctx));
    }

    /// Mint a new NEFTIT NFT
    public entry fun mint_nft(
        _mint_cap: &MintCap,
        name: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        rarity: vector<u8>,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let nft = NeftitNFT {
            id: object::new(ctx),
            name: string::utf8(name),
            description: string::utf8(description),
            image_url: url::new_unsafe_from_bytes(image_url),
            rarity: string::utf8(rarity),
            creator: tx_context::sender(ctx),
        };

        let nft_id = object::uid_to_address(&nft.id);

        event::emit(NFTMinted {
            object_id: nft_id,
            name: nft.name,
            recipient,
            rarity: nft.rarity,
        });

        transfer::public_transfer(nft, recipient);
    }

    /// Mint NFT to sender (for direct minting)
    public entry fun mint_to_sender(
        _mint_cap: &MintCap,
        name: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        rarity: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        mint_nft(_mint_cap, name, description, image_url, rarity, sender, ctx);
    }

    /// Batch mint multiple NFTs to the same recipient
    public entry fun batch_mint(
        mint_cap: &MintCap,
        names: vector<vector<u8>>,
        descriptions: vector<vector<u8>>,
        image_urls: vector<vector<u8>>,
        rarities: vector<vector<u8>>,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let len = std::vector::length(&names);
        assert!(len == std::vector::length(&descriptions), 1);
        assert!(len == std::vector::length(&image_urls), 2);
        assert!(len == std::vector::length(&rarities), 3);

        let i = 0;
        while (i < len) {
            mint_nft(
                mint_cap,
                *std::vector::borrow(&names, i),
                *std::vector::borrow(&descriptions, i),
                *std::vector::borrow(&image_urls, i),
                *std::vector::borrow(&rarities, i),
                recipient,
                ctx
            );
            i = i + 1;
        };
    }

    /// Get NFT information
    public fun get_nft_info(nft: &NeftitNFT): (String, String, Url, String, address) {
        (nft.name, nft.description, nft.image_url, nft.rarity, nft.creator)
    }

    /// Get NFT name
    public fun name(nft: &NeftitNFT): String {
        nft.name
    }

    /// Get NFT description
    public fun description(nft: &NeftitNFT): String {
        nft.description
    }

    /// Get NFT image URL
    public fun image_url(nft: &NeftitNFT): Url {
        nft.image_url
    }

    /// Get NFT rarity
    public fun rarity(nft: &NeftitNFT): String {
        nft.rarity
    }

    /// Get NFT creator
    public fun creator(nft: &NeftitNFT): address {
        nft.creator
    }

    /// Transfer mint capability to another address
    public entry fun transfer_mint_cap(mint_cap: MintCap, recipient: address) {
        transfer::transfer(mint_cap, recipient);
    }
}
