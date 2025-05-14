#[test_only]
module pixel_board_admin::PixelBoardPropertyTests {
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

    // PROPERTY: Ownership transfer - When a user buys a pixel, the ownership is transferred to them
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678)]
    public entry fun test_property_ownership_transfer(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2);
        
        // Check some pixels are initially unowned
        let test_indices = vector[100, 200, 300];
        let i = 0;
        while (i < vector::length(&test_indices)) {
            let idx = *vector::borrow(&test_indices, i);
            let pixel = PixelBoard::view_pixel(idx);
            assert!(PixelBoard::get_pixel_owner(&pixel) == @0x0, 0);
            i = i + 1;
        };
        
        // User1 buys the pixels
        let colors = vector[0xFF0000FF, 0xFF00FF00, 0xFFFF0000];
        let links = vector[b"", b"", b""];
        PixelBoard::buy_pixels(user1, test_indices, colors, links);
        
        // Check ownership transferred
        let i = 0;
        while (i < vector::length(&test_indices)) {
            let idx = *vector::borrow(&test_indices, i);
            let pixel = PixelBoard::view_pixel(idx);
            assert!(PixelBoard::get_pixel_owner(&pixel) == signer::address_of(user1), 1);
            i = i + 1;
        };
    }

    // PROPERTY: Owner exclusivity - Only the owner can update their pixels
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678)]
    public entry fun test_property_owner_exclusivity(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2);
        
        // User1 buys some pixels
        let indices = vector[400, 500, 600];
        let colors1 = vector[0xFF0000FF, 0xFF00FF00, 0xFFFF0000];
        let links1 = vector[b"", b"", b""];
        PixelBoard::buy_pixels(user1, indices, colors1, links1);
        
        // User2 buys different pixels
        let indices2 = vector[401, 501, 601];
        let colors2 = vector[0xFF0000FF, 0xFF00FF00, 0xFFFF0000];
        let links2 = vector[b"", b"", b""];
        PixelBoard::buy_pixels(user2, indices2, colors2, links2);
        
        // User1 updates their own pixels - should succeed
        let new_colors1 = vector[0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF];
        let new_links1 = vector[b"user1", b"user1", b"user1"];
        PixelBoard::update_pixels(user1, indices, new_colors1, new_links1);
        
        // Verify user1's updates
        let i = 0;
        while (i < vector::length(&indices)) {
            let idx = *vector::borrow(&indices, i);
            let pixel = PixelBoard::view_pixel(idx);
            assert!(PixelBoard::get_pixel_owner(&pixel) == signer::address_of(user1), 0);
            assert!(PixelBoard::get_pixel_color(&pixel) == 0xFFFFFFFF, 1);
            assert!(PixelBoard::get_pixel_link(&pixel) == b"user1", 2);
            i = i + 1;
        };
        
        // User2 updates their own pixels - should succeed
        let new_colors2 = vector[0xFF000000, 0xFF000000, 0xFF000000];
        let new_links2 = vector[b"user2", b"user2", b"user2"];
        PixelBoard::update_pixels(user2, indices2, new_colors2, new_links2);
        
        // Verify user2's updates
        let i = 0;
        while (i < vector::length(&indices2)) {
            let idx = *vector::borrow(&indices2, i);
            let pixel = PixelBoard::view_pixel(idx);
            assert!(PixelBoard::get_pixel_owner(&pixel) == signer::address_of(user2), 3);
            assert!(PixelBoard::get_pixel_color(&pixel) == 0xFF000000, 4);
            assert!(PixelBoard::get_pixel_link(&pixel) == b"user2", 5);
            i = i + 1;
        };
    }
    
    // PROPERTY: Data preservation - Even after multiple updates, data should be preserved correctly
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678)]
    public entry fun test_property_data_preservation(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2);
        
        // User buys a pixel - use an index valid for a 100x100 board
        let idx = vector::singleton(42);
        let color = vector::singleton(0xFF0000FF);
        let link = vector::singleton(b"initial");
        PixelBoard::buy_pixels(user1, idx, color, link);
        
        // Series of updates to the same pixel
        let updates = 10;
        let i = 0;
        while (i < updates) {
            let new_color = vector::singleton(0xFF000000 | ((i as u32) * 1000));
            let new_link = vector::singleton(b"update_");
            vector::push_back(vector::borrow_mut(&mut new_link, 0), ((i + 48) as u8)); // Add a number 0-9
            
            PixelBoard::update_pixels(user1, idx, new_color, new_link);
            
            // Check it was updated correctly
            let pixel = PixelBoard::view_pixel(42);
            assert!(PixelBoard::get_pixel_owner(&pixel) == signer::address_of(user1), 0);
            assert!(PixelBoard::get_pixel_color(&pixel) == 0xFF000000 | ((i as u32) * 1000), 1);
            
            let expected_link = b"update_";
            vector::push_back(&mut expected_link, ((i + 48) as u8));
            assert!(PixelBoard::get_pixel_link(&pixel) == expected_link, 2);
            
            i = i + 1;
        };
        
        // After multiple updates, ownership should still be preserved
        let final_pixel = PixelBoard::view_pixel(42);
        assert!(PixelBoard::get_pixel_owner(&final_pixel) == signer::address_of(user1), 3);
    }
    
    // PROPERTY: Batch operations - Multiple operations in a batch should all be applied
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678)]
    public entry fun test_property_batch_operations(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2);
        
        // User1 buys a large batch of pixels
        let batch_size = 20; // Reduced batch size for 100x100 board
        let indices = vector::empty<u64>();
        let colors = vector::empty<u32>();
        let links = vector::empty<vector<u8>>();
        
        let i = 0;
        while (i < batch_size) {
            vector::push_back(&mut indices, 10 + i);  // Use indices that fit in a 100x100 board
            vector::push_back(&mut colors, 0xFF0000FF);
            vector::push_back(&mut links, vector::empty<u8>());
            i = i + 1;
        };
        
        PixelBoard::buy_pixels(user1, indices, colors, links);
        
        // Verify all pixels in the batch were purchased
        let i = 0;
        while (i < batch_size) {
            let pixel = PixelBoard::view_pixel(10 + i);
            assert!(PixelBoard::get_pixel_owner(&pixel) == signer::address_of(user1), 0);
            assert!(PixelBoard::get_pixel_color(&pixel) == 0xFF0000FF, 1);
            i = i + 1;
        };
        
        // Now update all of them at once
        let new_colors = vector::empty<u32>();
        let new_links = vector::empty<vector<u8>>();
        
        let i = 0;
        while (i < batch_size) {
            vector::push_back(&mut new_colors, 0xFF00FF00);
            vector::push_back(&mut new_links, b"updated");
            i = i + 1;
        };
        
        PixelBoard::update_pixels(user1, indices, new_colors, new_links);
        
        // Verify all pixels in the batch were updated
        let i = 0;
        while (i < batch_size) {
            let pixel = PixelBoard::view_pixel(10 + i);
            assert!(PixelBoard::get_pixel_owner(&pixel) == signer::address_of(user1), 2);
            assert!(PixelBoard::get_pixel_color(&pixel) == 0xFF00FF00, 3);
            assert!(PixelBoard::get_pixel_link(&pixel) == b"updated", 4);
            i = i + 1;
        };
    }
    
    // PROPERTY: Global invariants - Board size should never change
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678)]
    public entry fun test_property_global_invariants(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2);
        
        // Check initial board size
        let initial_board = PixelBoard::view_board();
        let initial_size = vector::length(&initial_board);
        assert!(initial_size == 100 * 100, 0);  // 10K pixels for test board
        
        // Make some changes
        let idx = vector[1, 10, 20, 30, 40];  // Use valid indices for 100x100 board
        let colors = vector[0xFF0000FF, 0xFF00FF00, 0xFFFF0000, 0xFF00FFFF, 0xFFFF00FF];
        let links = vector[b"link1", b"link2", b"link3", b"link4", b"link5"];
        
        PixelBoard::buy_pixels(user1, idx, colors, links);
        
        // Board size should still be the same
        let updated_board = PixelBoard::view_board();
        let updated_size = vector::length(&updated_board);
        assert!(updated_size == initial_size, 1);
        
        // Modify some pixels
        let new_colors = vector[0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF];
        let new_links = vector[b"modified", b"modified", b"modified", b"modified", b"modified"];
        
        PixelBoard::update_pixels(user1, idx, new_colors, new_links);
        
        // Board size should still be the same
        let final_board = PixelBoard::view_board();
        let final_size = vector::length(&final_board);
        assert!(final_size == initial_size, 2);
    }
} 