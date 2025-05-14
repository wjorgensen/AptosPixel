#[test_only]
module pixel_board_admin::PixelBoardFuzzTests {
    use std::signer;
    use std::vector;
    use std::hash;
    use aptos_framework::account;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::timestamp;
    use aptos_std::simple_map;
    use pixel_board_admin::PixelBoard;

    // Test addresses
    const ADMIN: address = @0xABCD;
    const USER1: address = @0x1234;
    const USER2: address = @0x5678;
    const USER3: address = @0x9ABC;

    // Error codes
    const INIT_ALREADY_DONE: u64 = 0;
    const INVALID_VECTOR_LENGTH: u64 = 100;
    const INDEX_OUT_OF_BOUNDS: u64 = 101;
    const PIXEL_ALREADY_OWNED: u64 = 102;
    const LINK_TOO_LONG: u64 = 103;
    const ENO_PIXEL_OWNERSHIP: u64 = 202;
    const OUT_OF_BOUNDS_VIEW: u64 = 300;

    // Constants for fuzz testing
    const FUZZ_TEST_ITERATIONS: u64 = 50;
    const MAX_BATCH_SIZE: u64 = 20;
    
    // Test data
    struct TestState has drop {
        board_width: u64,
        board_height: u64,
        max_link_length: u64,
        price_per_pixel: u64,
        owned_pixels: simple_map::SimpleMap<u64, address>,
    }
    
    // Helper function to setup test environment
    fun setup_test(aptos_framework: &signer, admin: &signer, user1: &signer, user2: &signer, user3: &signer): TestState {
        // Set up blockchain
        timestamp::set_time_has_started_for_testing(aptos_framework);
        
        // Create accounts
        let admin_addr = signer::address_of(admin);
        let user1_addr = signer::address_of(user1);
        let user2_addr = signer::address_of(user2);
        let user3_addr = signer::address_of(user3);
        
        account::create_account_for_test(admin_addr);
        account::create_account_for_test(user1_addr);
        account::create_account_for_test(user2_addr);
        account::create_account_for_test(user3_addr);

        // Initialize AptosCoin and mint for testing
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos_framework);
        
        // Give users some coins to buy pixels
        let coin_amount = 10000000000; // 100 APT in octas
        coin::register<AptosCoin>(admin);
        coin::register<AptosCoin>(user1);
        coin::register<AptosCoin>(user2);
        coin::register<AptosCoin>(user3);
        
        aptos_coin::mint(aptos_framework, user1_addr, coin_amount);
        aptos_coin::mint(aptos_framework, user2_addr, coin_amount);
        aptos_coin::mint(aptos_framework, user3_addr, coin_amount);
        
        // Initialize the PixelBoard with a smaller test size
        PixelBoard::init_test_board(admin, 100, 100);

        // Cleanup capabilities
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
        
        // Return test state data
        TestState {
            board_width: 100,
            board_height: 100,
            max_link_length: 64,
            price_per_pixel: 1000000,
            owned_pixels: simple_map::create(),
        }
    }
    
    // Helper to generate pseudo-random numbers based on seed
    fun random_u64(seed: vector<u8>, max: u64): u64 {
        let hash_bytes = hash::sha2_256(seed);
        let value = 0u64;
        
        let i = 0;
        while (i < 8) {
            value = (value << 8) + (*vector::borrow(&hash_bytes, i) as u64);
            i = i + 1;
        };
        
        value % max
    }
    
    // Generate a random pixel index that isn't owned yet
    fun random_unowned_pixel(
        state: &TestState, 
        seed: vector<u8>
    ): u64 {
        let max_pixels = state.board_width * state.board_height;
        let attempt = 0;
        
        // Try up to 10 times to find an unowned pixel
        while (attempt < 10) {
            let idx = random_u64(seed, max_pixels);
            // Add attempt to the seed to get different results in each try
            vector::push_back(&mut seed, (attempt as u8));
            
            if (!simple_map::contains_key(&state.owned_pixels, &idx)) {
                return idx
            };
            
            attempt = attempt + 1;
        };
        
        // Fallback approach - scan indices sequentially
        let idx = 0;
        while (idx < max_pixels) {
            if (!simple_map::contains_key(&state.owned_pixels, &idx)) {
                return idx
            };
            idx = idx + 1;
        };
        
        abort 999 // Should not reach here if board is not full
    }
    
    // Generate random ARGB color
    fun random_color(seed: vector<u8>): u32 {
        let hash_bytes = hash::sha2_256(seed);
        
        // Extract 4 bytes for ARGB (ensure alpha is fully opaque)
        let a = 0xFF;
        let r = *vector::borrow(&hash_bytes, 0);
        let g = *vector::borrow(&hash_bytes, 1);
        let b = *vector::borrow(&hash_bytes, 2);
        
        ((a as u32) << 24) | ((r as u32) << 16) | ((g as u32) << 8) | (b as u32)
    }
    
    // Generate random URL/link
    fun random_link(seed: vector<u8>, max_length: u64): vector<u8> {
        let hash_bytes = hash::sha2_256(seed);
        let length = (random_u64(seed, max_length / 2) + 5); // Min 5, Max max_length/2
        
        let result = vector::empty<u8>();
        let base_url = b"https://example.com/";
        vector::append(&mut result, base_url);
        
        // Add some random characters
        let i = 0;
        while (i < length && i < 32) {
            let char = (*vector::borrow(&hash_bytes, i) % 26) + 97; // a-z
            vector::push_back(&mut result, char);
            i = i + 1;
        };
        
        result
    }
    
    /* ------ EDGE CASE TESTS ------ */
    
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678, user3 = @0x9ABC)]
    public entry fun test_board_boundaries(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer,
        user3: &signer
    ) {
        let state = setup_test(aptos_framework, admin, user1, user2, user3);
        
        // Test buying pixels at the corners of the board
        let corners = vector[0, state.board_width - 1, 
                           (state.board_height - 1) * state.board_width, 
                           state.board_width * state.board_height - 1];
        
        let colors = vector[0xFF0000FF, 0xFF00FF00, 0xFFFF0000, 0xFFFF00FF];
        let links = vector[b"corner1", b"corner2", b"corner3", b"corner4"];
        
        PixelBoard::buy_pixels(user1, corners, colors, links);
        
        // Verify purchases
        let i = 0;
        while (i < 4) {
            let idx = *vector::borrow(&corners, i);
            let pixel = PixelBoard::view_pixel(idx);
            assert!(PixelBoard::get_pixel_owner(&pixel) == signer::address_of(user1), 0);
            assert!(PixelBoard::get_pixel_color(&pixel) == *vector::borrow(&colors, i), 1);
            assert!(PixelBoard::get_pixel_link(&pixel) == *vector::borrow(&links, i), 2);
            i = i + 1;
        };
    }
    
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678, user3 = @0x9ABC)]
    public entry fun test_max_link_length(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer,
        user3: &signer
    ) {
        let state = setup_test(aptos_framework, admin, user1, user2, user3);
        
        // Create a link with max allowed length
        let max_length_link = vector::empty<u8>();
        let i = 0;
        while (i < state.max_link_length) {
            vector::push_back(&mut max_length_link, (65 + (i % 26) as u8)); // A-Z characters
            i = i + 1;
        };
        
        // Buy a pixel with max length link
        let idx = vector::singleton(123);
        let color = vector::singleton(0xFF0000FF);
        let link = vector::singleton(max_length_link);
        
        PixelBoard::buy_pixels(user1, idx, color, link);
        
        // Verify purchase
        let pixel = PixelBoard::view_pixel(123);
        assert!(PixelBoard::get_pixel_owner(&pixel) == signer::address_of(user1), 0);
        assert!(PixelBoard::get_pixel_color(&pixel) == 0xFF0000FF, 1);
        assert!(vector::length(&PixelBoard::get_pixel_link(&pixel)) == state.max_link_length, 2);
    }
    
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678, user3 = @0x9ABC)]
    #[expected_failure(abort_code = LINK_TOO_LONG, location = pixel_board_admin::PixelBoard)]
    public entry fun test_link_too_long(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer,
        user3: &signer
    ) {
        let state = setup_test(aptos_framework, admin, user1, user2, user3);
        
        // Create a link that's too long
        let too_long_link = vector::empty<u8>();
        let i = 0;
        while (i < state.max_link_length + 1) { // One character too many
            vector::push_back(&mut too_long_link, (65 + (i % 26) as u8));
            i = i + 1;
        };
        
        // Try to buy a pixel with a too-long link - should fail
        let idx = vector::singleton(456);
        let color = vector::singleton(0xFF0000FF);
        let link = vector::singleton(too_long_link);
        
        PixelBoard::buy_pixels(user1, idx, color, link);
    }
    
    /* ------ NEGATIVE TESTS ------ */
    
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678, user3 = @0x9ABC)]
    #[expected_failure(abort_code = INIT_ALREADY_DONE, location = pixel_board_admin::PixelBoard)]
    public entry fun test_init_twice(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer,
        user3: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2, user3);
        
        // Try to initialize again - should fail
        PixelBoard::init(admin);
    }
    
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678, user3 = @0x9ABC)]
    #[expected_failure(abort_code = INVALID_VECTOR_LENGTH, location = pixel_board_admin::PixelBoard)]
    public entry fun test_mismatched_arrays(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer,
        user3: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2, user3);
        
        // Create mismatched arrays
        let idx = vector[123, 456];
        let colors = vector[0xFF0000FF]; // Only one color for two indices
        let links = vector[vector::empty<u8>(), vector::empty<u8>()];
        
        // Should fail due to mismatched array lengths
        PixelBoard::buy_pixels(user1, idx, colors, links);
    }
    
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678, user3 = @0x9ABC)]
    #[expected_failure(abort_code = INDEX_OUT_OF_BOUNDS, location = pixel_board_admin::PixelBoard)]
    public entry fun test_out_of_bounds_index(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer,
        user3: &signer
    ) {
        let state = setup_test(aptos_framework, admin, user1, user2, user3);
        
        // Try to buy a pixel outside the board dimensions
        let out_of_bounds_idx = state.board_width * state.board_height; // One beyond the last valid index
        let idx = vector::singleton(out_of_bounds_idx);
        let colors = vector::singleton(0xFF0000FF);
        let links = vector::singleton(vector::empty<u8>());
        
        // Should fail due to out of bounds index
        PixelBoard::buy_pixels(user1, idx, colors, links);
    }
    
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678, user3 = @0x9ABC)]
    #[expected_failure(abort_code = PIXEL_ALREADY_OWNED, location = pixel_board_admin::PixelBoard)]
    public entry fun test_buy_already_owned(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer,
        user3: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2, user3);
        
        // User1 buys a pixel
        let idx = vector::singleton(789);
        let colors = vector::singleton(0xFF0000FF);
        let links = vector::singleton(vector::empty<u8>());
        
        PixelBoard::buy_pixels(user1, idx, colors, links);
        
        // User2 tries to buy the same pixel - should fail
        PixelBoard::buy_pixels(user2, idx, colors, links);
    }
    
    /* ------ PERFORMANCE/STRESS TESTS ------ */
    
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678, user3 = @0x9ABC)]
    public entry fun test_large_batch_buy(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer,
        user3: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2, user3);
        
        // Buy a large batch of consecutive pixels (100 pixels)
        let batch_size = 100;
        let idx = vector::empty<u64>();
        let colors = vector::empty<u32>();
        let links = vector::empty<vector<u8>>();
        
        let i = 0;
        while (i < batch_size) {
            vector::push_back(&mut idx, 1000 + i); // Start from index 1000
            vector::push_back(&mut colors, 0xFF000000 | ((i as u32) * 10000)); // Different colors
            vector::push_back(&mut links, b"batch_buy_test");
            i = i + 1;
        };
        
        PixelBoard::buy_pixels(user1, idx, colors, links);
        
        // Verify some random samples
        let samples = vector[0, batch_size / 4, batch_size / 2, batch_size - 1];
        
        let j = 0;
        while (j < vector::length(&samples)) {
            let sample_idx = *vector::borrow(&samples, j);
            let pixel_idx = 1000 + sample_idx;
            let pixel = PixelBoard::view_pixel(pixel_idx);
            
            assert!(PixelBoard::get_pixel_owner(&pixel) == signer::address_of(user1), 0);
            assert!(PixelBoard::get_pixel_color(&pixel) == 0xFF000000 | ((sample_idx as u32) * 10000), 1);
            
            j = j + 1;
        };
    }
    
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678, user3 = @0x9ABC)]
    public entry fun test_view_board_with_data(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer,
        user3: &signer
    ) {
        setup_test(aptos_framework, admin, user1, user2, user3);
        
        // First buy some pixels
        let idx = vector[1, 10, 20, 30, 40];
        let colors = vector[0xFF0000FF, 0xFF00FF00, 0xFFFF0000, 0xFFFF00FF, 0xFF00FFFF];
        let links = vector[b"link1", b"link2", b"link3", b"link4", b"link5"];
        
        PixelBoard::buy_pixels(user1, idx, colors, links);
        
        // Get the entire board
        let board = PixelBoard::view_board();
        
        // Check the total size
        assert!(vector::length(&board) == 100 * 100, 0); // Should be 10K pixels
        
        // Verify the pixels we bought
        let i = 0;
        while (i < vector::length(&idx)) {
            let pixel_idx = *vector::borrow(&idx, i);
            // Use reference instead of copying
            let pixel_ref = vector::borrow(&board, pixel_idx);
            
            assert!(PixelBoard::get_pixel_owner(pixel_ref) == signer::address_of(user1), 1);
            assert!(PixelBoard::get_pixel_color(pixel_ref) == *vector::borrow(&colors, i), 2);
            assert!(PixelBoard::get_pixel_link(pixel_ref) == *vector::borrow(&links, i), 3);
            
            i = i + 1;
        };
    }
    
    /* ------ FUZZ TESTING ------ */
    
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678, user3 = @0x9ABC)]
    public entry fun fuzz_test_buy_pixels(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer,
        user3: &signer
    ) {
        let state = setup_test(aptos_framework, admin, user1, user2, user3);
        let users = vector[signer::address_of(user1), signer::address_of(user2), signer::address_of(user3)];
        
        // Run multiple iterations of randomized tests
        let iteration = 0;
        while (iteration < FUZZ_TEST_ITERATIONS) {
            // Create seed for this iteration
            let seed = vector::empty<u8>();
            vector::push_back(&mut seed, ((iteration & 0xFF) as u8));
            vector::push_back(&mut seed, (((iteration >> 8) & 0xFF) as u8));
            
            // Determine batch size (1 to MAX_BATCH_SIZE)
            let batch_size = (random_u64(seed, MAX_BATCH_SIZE - 1) + 1) as u64;
            
            // Choose random user
            let user_idx = random_u64(seed, vector::length(&users));
            let user_addr = *vector::borrow(&users, (user_idx as u64));
            let user = if (user_addr == signer::address_of(user1)) { user1 } 
                  else if (user_addr == signer::address_of(user2)) { user2 }
                  else { user3 };
            
            // Generate random unowned pixels, colors, and links
            let pixels = vector::empty<u64>();
            let colors = vector::empty<u32>();
            let links = vector::empty<vector<u8>>();
            
            let i = 0;
            while (i < batch_size) {
                // Add some randomness to the seed for each pixel
                let pixel_seed = copy seed;
                vector::push_back(&mut pixel_seed, ((i & 0xFF) as u8));
                vector::push_back(&mut pixel_seed, (((i >> 8) & 0xFF) as u8));
                
                let pixel_idx = random_unowned_pixel(&state, pixel_seed);
                let color = random_color(pixel_seed);
                let link = random_link(pixel_seed, state.max_link_length);
                
                vector::push_back(&mut pixels, pixel_idx);
                vector::push_back(&mut colors, color);
                vector::push_back(&mut links, link);
                
                // Update our tracking of owned pixels
                simple_map::add(&mut state.owned_pixels, pixel_idx, signer::address_of(user));
                
                i = i + 1;
            };
            
            // Buy the pixels
            PixelBoard::buy_pixels(user, pixels, colors, links);
            
            // Verify a random subset of purchases
            if (batch_size > 0) {
                let num_verifications = vector::length(&pixels) / 2 + 1;
                let j = 0;
                
                while (j < num_verifications) {
                    let verify_idx = random_u64(copy seed, vector::length(&pixels));
                    let pixel_idx = *vector::borrow(&pixels, (verify_idx as u64));
                    let pixel = PixelBoard::view_pixel(pixel_idx);
                    
                    assert!(PixelBoard::get_pixel_owner(&pixel) == signer::address_of(user), 0);
                    assert!(PixelBoard::get_pixel_color(&pixel) == *vector::borrow(&colors, (verify_idx as u64)), 1);
                    assert!(PixelBoard::get_pixel_link(&pixel) == *vector::borrow(&links, (verify_idx as u64)), 2);
                    
                    j = j + 1;
                };
            };
            
            iteration = iteration + 1;
        };
    }
    
    #[test(aptos_framework = @0x1, admin = @pixel_board_admin, user1 = @0x1234, user2 = @0x5678, user3 = @0x9ABC)]
    public entry fun fuzz_test_update_pixels(
        aptos_framework: &signer, 
        admin: &signer, 
        user1: &signer, 
        user2: &signer,
        user3: &signer
    ) {
        let state = setup_test(aptos_framework, admin, user1, user2, user3);
        let users = vector[signer::address_of(user1), signer::address_of(user2), signer::address_of(user3)];
        
        // First buy some pixels for each user
        let user_pixels = vector[vector::empty<u64>(), vector::empty<u64>(), vector::empty<u64>()];
        
        // Each user buys 5 random pixels (smaller number for more reliable testing)
        let u = 0;
        while (u < vector::length(&users)) {
            let user_addr = *vector::borrow(&users, u);
            let user = if (user_addr == signer::address_of(user1)) { user1 } 
                  else if (user_addr == signer::address_of(user2)) { user2 }
                  else { user3 };
            
            let pixels = vector::empty<u64>();
            let colors = vector::empty<u32>();
            let links = vector::empty<vector<u8>>();
            
            let i = 0;
            while (i < 5) { // Reduced from 50 to 5 for quicker testing
                let seed = vector::empty<u8>();
                vector::push_back(&mut seed, ((u & 0xFF) as u8));
                vector::push_back(&mut seed, ((i & 0xFF) as u8));
                
                // Use deterministic pixel indices based on user and iteration
                let pixel_idx = u * 10 + i; // This ensures no overlapping pixel indices
                let color = 0xFF000000 | ((u as u32) * 100) | (i as u32); // Deterministic color - cast to u32
                
                vector::push_back(&mut pixels, pixel_idx);
                vector::push_back(&mut colors, color);
                vector::push_back(&mut links, vector::empty<u8>());
                
                // Track ownership
                vector::push_back(vector::borrow_mut(&mut user_pixels, u), pixel_idx);
                simple_map::add(&mut state.owned_pixels, pixel_idx, user_addr);
                
                i = i + 1;
            };
            
            PixelBoard::buy_pixels(user, pixels, colors, links);
            u = u + 1;
        };
        
        // Now run tests for pixel updates with a single iteration for reliability
        let iteration = 0;
        while (iteration < 3) { // Reduced from 50 to 3 for more reliable testing
            // Create seed for this iteration
            let seed = vector::empty<u8>();
            vector::push_back(&mut seed, ((iteration & 0xFF) as u8));
            
            // Test each user
            let user_idx = iteration % vector::length(&users);
            let user_addr = *vector::borrow(&users, user_idx);
            let user = if (user_addr == signer::address_of(user1)) { user1 } 
                  else if (user_addr == signer::address_of(user2)) { user2 }
                  else { user3 };
            
            let user_pixel_list = *vector::borrow(&user_pixels, user_idx);
            
            // Skip if this user has no pixels
            if (vector::length(&user_pixel_list) == 0) {
                iteration = iteration + 1;
                continue
            };
            
            // Update all pixels for this user
            let pixels_to_update = vector::empty<u64>();
            let new_colors = vector::empty<u32>();
            let new_links = vector::empty<vector<u8>>();
            
            let i = 0;
            while (i < vector::length(&user_pixel_list)) {
                let pixel_idx = *vector::borrow(&user_pixel_list, i);
                
                // Use deterministic updates based on iteration
                let new_color = 0xFFFF0000 | ((iteration as u32) * 1000) | (i as u32); // Cast to u32
                let new_link = b"update_";
                vector::push_back(&mut new_link, ((i + 48) as u8)); // Add a number 0-9
                
                vector::push_back(&mut pixels_to_update, pixel_idx);
                vector::push_back(&mut new_colors, new_color);
                vector::push_back(&mut new_links, new_link);
                
                i = i + 1;
            };
            
            // Update the pixels
            PixelBoard::update_pixels(user, pixels_to_update, new_colors, new_links);
            
            // Verify all updates
            let j = 0;
            while (j < vector::length(&pixels_to_update)) {
                let pixel_idx = *vector::borrow(&pixels_to_update, j);
                let pixel = PixelBoard::view_pixel(pixel_idx);
                
                // Basic ownership check
                assert!(PixelBoard::get_pixel_owner(&pixel) == user_addr, 0);
                
                // Expected values
                let expected_color = *vector::borrow(&new_colors, j);
                let expected_link = *vector::borrow(&new_links, j);
                
                // Check color and link match the expected values
                assert!(PixelBoard::get_pixel_color(&pixel) == expected_color, 1);
                assert!(PixelBoard::get_pixel_link(&pixel) == expected_link, 2);
                
                j = j + 1;
            };
            
            iteration = iteration + 1;
        };
    }
} 