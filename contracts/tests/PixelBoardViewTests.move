#[test_only]
module pixel_board_admin::PixelBoardViewTests {
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
    const OUT_OF_BOUNDS_VIEW: u64 = 300;
    
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
        PixelBoard::init_test_board(admin, 100, 100); // 10x10 = 100 pixels instead of 1M

        // Cleanup capabilities
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    /* ===== VIEW FUNCTION TESTS ===== */

    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678)]
    public entry fun test_view_board_initial_state(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2);
        
        // Get the entire board
        let board = PixelBoard::view_board();
        
        // Check the total size (100 x 100 = 10K pixels)
        assert!(vector::length(&board) == 100 * 100, 0);
        
        // Check some random pixels to verify they're properly initialized
        // Use valid indices for a 100x100 board
        let sample_indices = vector[0, 1, 50, 99, 9999]; 
        
        let i = 0;
        while (i < vector::length(&sample_indices)) {
            let idx = *vector::borrow(&sample_indices, i);
            // Instead of copying, use the reference directly
            let pixel_ref = vector::borrow(&board, idx);
            
            // All pixels should be white (0xFFFFFFFF) and unowned (0x0) initially
            assert!(PixelBoard::get_pixel_owner(pixel_ref) == @0x0, 1);
            assert!(PixelBoard::get_pixel_color(pixel_ref) == 0xFFFFFFFF, 2);
            assert!(vector::length(&PixelBoard::get_pixel_link(pixel_ref)) == 0, 3);
            
            i = i + 1;
        };
    }

    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678)]
    public entry fun test_view_pixel_mapping(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2);
        
        // Create a pattern with different pixels - use indices valid for a 100x100 board
        let indices = vector[5, 10, 25, 50, 75];
        let colors = vector[0xFF0000FF, 0xFF00FF00, 0xFFFF0000, 0xFF00FFFF, 0xFFFF00FF];
        let links = vector[b"link1", b"link2", b"link3", b"link4", b"link5"];
        
        // Buy the pixels
        PixelBoard::buy_pixels(user1, indices, colors, links);
        
        // Get the whole board
        let board = PixelBoard::view_board();
        
        // Test that individual pixel views match the board view
        let i = 0;
        while (i < vector::length(&indices)) {
            let idx = *vector::borrow(&indices, i);
            
            // Get the pixel both ways - use references instead of copying
            let board_pixel_ref = vector::borrow(&board, idx);
            let individual_pixel = PixelBoard::view_pixel(idx);
            
            // Both should match
            assert!(PixelBoard::get_pixel_owner(board_pixel_ref) == PixelBoard::get_pixel_owner(&individual_pixel), 0);
            assert!(PixelBoard::get_pixel_color(board_pixel_ref) == PixelBoard::get_pixel_color(&individual_pixel), 1);
            assert!(PixelBoard::get_pixel_link(board_pixel_ref) == PixelBoard::get_pixel_link(&individual_pixel), 2);
            
            // And should match the expected values
            assert!(PixelBoard::get_pixel_owner(&individual_pixel) == signer::address_of(user1), 3);
            assert!(PixelBoard::get_pixel_color(&individual_pixel) == *vector::borrow(&colors, i), 4);
            assert!(PixelBoard::get_pixel_link(&individual_pixel) == *vector::borrow(&links, i), 5);
            
            i = i + 1;
        };
    }

    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678)]
    public entry fun test_pixel_accessor_functions(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2);
        
        // Buy a pixel with specific values - use an index valid for a 100x100 board
        let idx = vector::singleton(42);
        let color = vector::singleton(0xFF123456);
        let link = vector::singleton(b"test_accessor_functions");
        
        PixelBoard::buy_pixels(user1, idx, color, link);
        
        // Get the pixel
        let pixel = PixelBoard::view_pixel(42);
        
        // Test each accessor function
        assert!(PixelBoard::get_pixel_owner(&pixel) == signer::address_of(user1), 0);
        assert!(PixelBoard::get_pixel_color(&pixel) == 0xFF123456, 1);
        assert!(PixelBoard::get_pixel_link(&pixel) == b"test_accessor_functions", 2);
    }

    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678)]
    #[expected_failure(abort_code = OUT_OF_BOUNDS_VIEW, location = pixel_board_admin::PixelBoard)]
    public entry fun test_view_pixel_out_of_bounds(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2);
        
        // Try to view a pixel outside the board dimensions - should fail
        PixelBoard::view_pixel(1000 * 1000); // One beyond the last valid index
    }

    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678)]
    public entry fun test_board_initial_dimensions(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2);
        
        // Get the entire board
        let board = PixelBoard::view_board();
        
        // Verify dimensions
        let total_pixels = vector::length(&board);
        assert!(total_pixels == 100 * 100, 0); // 10K pixels
        
        // Check pixels at board edges
        let top_left = PixelBoard::view_pixel(0);
        let top_right = PixelBoard::view_pixel(99);
        let bottom_left = PixelBoard::view_pixel(99 * 100);
        let bottom_right = PixelBoard::view_pixel(100 * 100 - 1);
        
        // All corners should be initialized to default values
        assert!(PixelBoard::get_pixel_owner(&top_left) == @0x0, 1);
        assert!(PixelBoard::get_pixel_owner(&top_right) == @0x0, 2);
        assert!(PixelBoard::get_pixel_owner(&bottom_left) == @0x0, 3);
        assert!(PixelBoard::get_pixel_owner(&bottom_right) == @0x0, 4);
    }
} 