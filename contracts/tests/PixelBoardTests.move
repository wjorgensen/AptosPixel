#[test_only]
module pixel_board_admin::PixelBoardTests {
    use std::signer;
    use std::vector;
    use aptos_framework::account;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::timestamp;
    use pixel_board_admin::PixelBoard;

    // Test addresses
    const ADMIN: address = @0xABCD;
    const USER1: address = @0x1234;
    const USER2: address = @0x5678;

    // Error codes
    const ENO_PIXEL_OWNERSHIP: u64 = 202;

    // Helper function to setup test environment
    fun setup_test(aptos_framework: &signer, admin: &signer, user1: &signer, user2: &signer) {
        // Set up blockchain
        timestamp::set_time_has_started_for_testing(aptos_framework);
        
        // Create accounts
        let admin_addr = signer::address_of(admin);
        let user1_addr = signer::address_of(user1);
        let user2_addr = signer::address_of(user2);
        
        account::create_account_for_test(admin_addr);
        account::create_account_for_test(user1_addr);
        account::create_account_for_test(user2_addr);

        // Initialize AptosCoin and mint for testing
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos_framework);
        
        // Give users some coins to buy pixels
        let coin_amount = 10000000000; // 100 APT in octas
        coin::register<AptosCoin>(admin);
        coin::register<AptosCoin>(user1);
        coin::register<AptosCoin>(user2);
        
        aptos_coin::mint(aptos_framework, user1_addr, coin_amount);
        aptos_coin::mint(aptos_framework, user2_addr, coin_amount);
        
        // Initialize the PixelBoard with a smaller test size
        PixelBoard::init_test_board(admin, 100, 100);

        // Cleanup capabilities
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678)]
    public entry fun test_buy_pixels(aptos_framework: &signer, admin: &signer, user1: &signer, user2: &signer) {
        setup_test(aptos_framework, admin, user1, user2);

        // Buy some pixels with USER1
        let indexes = vector::empty<u64>();
        let colors = vector::empty<u32>();
        let links = vector::empty<vector<u8>>();
        
        vector::push_back(&mut indexes, 0);
        vector::push_back(&mut indexes, 1);
        vector::push_back(&mut colors, 0xFF0000FF); // Red
        vector::push_back(&mut colors, 0xFF00FF00); // Green
        vector::push_back(&mut links, vector::empty<u8>());
        vector::push_back(&mut links, vector::empty<u8>());
        
        PixelBoard::buy_pixels(user1, indexes, colors, links);
        
        // Get a pixel to verify purchase
        let pixel0 = PixelBoard::view_pixel(0);
        assert!(PixelBoard::get_pixel_owner(&pixel0) == signer::address_of(user1), 0);
        assert!(PixelBoard::get_pixel_color(&pixel0) == 0xFF0000FF, 1);
    }

    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678)]
    public entry fun test_update_pixels(aptos_framework: &signer, admin: &signer, user1: &signer, user2: &signer) {
        setup_test(aptos_framework, admin, user1, user2);
        
        // First buy a pixel
        let indexes = vector::singleton(42);
        let colors = vector::singleton(0xFF0000FF); // Red
        let links = vector::singleton(vector::empty<u8>());
        PixelBoard::buy_pixels(user1, indexes, colors, links);
        
        // Now update it
        let new_colors = vector::singleton(0xFF00FF00); // Green
        let url_bytes = b"https://example.com";
        let new_links = vector::singleton(url_bytes);
        
        PixelBoard::update_pixels(user1, indexes, new_colors, new_links);
        
        // Verify the update
        let pixel = PixelBoard::view_pixel(42);
        assert!(PixelBoard::get_pixel_owner(&pixel) == signer::address_of(user1), 0);
        assert!(PixelBoard::get_pixel_color(&pixel) == 0xFF00FF00, 1); // Should be green now
        assert!(PixelBoard::get_pixel_link(&pixel) == url_bytes, 2);
    }

    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678)]
    #[expected_failure(abort_code = 202, location = pixel_board_admin::PixelBoard)]
    public entry fun test_update_unowned_pixel(aptos_framework: &signer, admin: &signer, user1: &signer, user2: &signer) {
        setup_test(aptos_framework, admin, user1, user2);
        
        // First buy a pixel with USER1
        let indexes = vector::singleton(99);
        let colors = vector::singleton(0xFF0000FF); // Red
        let links = vector::singleton(vector::empty<u8>());
        PixelBoard::buy_pixels(user1, indexes, colors, links);
        
        // Try to update it with USER2 - should fail
        let new_colors = vector::singleton(0xFF00FF00); // Green
        let new_links = vector::singleton(vector::empty<u8>());
        
        // This should fail with error code 202 (ENO_PIXEL_OWNERSHIP)
        PixelBoard::update_pixels(user2, indexes, new_colors, new_links);
    }

    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678)]
    public entry fun test_multiple_pixel_operations(aptos_framework: &signer, admin: &signer, user1: &signer, user2: &signer) {
        setup_test(aptos_framework, admin, user1, user2);
        
        // USER1 buys pixels 10, 11
        {
            let indexes = vector::empty<u64>();
            let colors = vector::empty<u32>();
            let links = vector::empty<vector<u8>>();
            
            vector::push_back(&mut indexes, 10);
            vector::push_back(&mut indexes, 11);
            vector::push_back(&mut colors, 0xFF0000FF); // Red
            vector::push_back(&mut colors, 0xFF00FF00); // Green
            vector::push_back(&mut links, vector::empty<u8>());
            vector::push_back(&mut links, vector::empty<u8>());
            
            PixelBoard::buy_pixels(user1, indexes, colors, links);
        };
        
        // USER2 buys pixel 12
        {
            let indexes = vector::singleton(12);
            let colors = vector::singleton(0xFFFF0000); // Blue
            let links = vector::singleton(vector::empty<u8>());
            
            PixelBoard::buy_pixels(user2, indexes, colors, links);
        };
        
        // USER1 updates their pixels
        {
            let indexes = vector::empty<u64>();
            let colors = vector::empty<u32>();
            let links = vector::empty<vector<u8>>();
            
            vector::push_back(&mut indexes, 10);
            vector::push_back(&mut indexes, 11);
            vector::push_back(&mut colors, 0xFFFF00FF); // Purple
            vector::push_back(&mut colors, 0xFF00FFFF); // Cyan
            vector::push_back(&mut links, b"https://example1.com");
            vector::push_back(&mut links, b"https://example2.com");
            
            PixelBoard::update_pixels(user1, indexes, colors, links);
        };
        
        // Verify states
        let pixel10 = PixelBoard::view_pixel(10);
        let pixel11 = PixelBoard::view_pixel(11);
        let pixel12 = PixelBoard::view_pixel(12);
        
        assert!(PixelBoard::get_pixel_owner(&pixel10) == signer::address_of(user1), 0);
        assert!(PixelBoard::get_pixel_color(&pixel10) == 0xFFFF00FF, 1); // Purple
        assert!(PixelBoard::get_pixel_link(&pixel10) == b"https://example1.com", 2);
        
        assert!(PixelBoard::get_pixel_owner(&pixel11) == signer::address_of(user1), 3);
        assert!(PixelBoard::get_pixel_color(&pixel11) == 0xFF00FFFF, 4); // Cyan
        assert!(PixelBoard::get_pixel_link(&pixel11) == b"https://example2.com", 5);
        
        assert!(PixelBoard::get_pixel_owner(&pixel12) == signer::address_of(user2), 6);
        assert!(PixelBoard::get_pixel_color(&pixel12) == 0xFFFF0000, 7); // Blue
    }
} 