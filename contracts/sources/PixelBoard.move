module pixel_board_admin::PixelBoard {
    use std::signer;
    use std::vector;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_std::table;

    /* -----------------------------------------------------------
       Global parameters
    ----------------------------------------------------------- */

    /// Board dimensions (1 000 x 1 000 = 1 000 000 pixels)
    const WIDTH:  u64 = 1_000;
    const HEIGHT: u64 = 1_000;

    /// Price per pixel in **octas** (0.01 APT = 1 000 000 octas)
    const PRICE_PER_PIXEL: u64 = 1_000_000;

    /// Maximum link length (bytes)
    const MAX_LINK_LEN: u64 = 64;

    /* -----------------------------------------------------------
       Data types
    ----------------------------------------------------------- */

    /// A single pixel
    struct Pixel has copy, drop, store {
        owner: address,
        argb:  u32,          // 0xAARRGGBB
        link:  vector<u8>,   // up to 64 bytes
    }

    /// Board lives as one resource that owns the Table
    struct Board has key {
        pixels: table::Table<u64, Pixel>,
    }

    /// A pair of pixel ID and pixel data for returning board state
    struct PixelWithId has copy, drop, store {
        id: u64,
        pixel: Pixel,
    }

    /* -----------------------------------------------------------
       ONE-TIME INITIALISATION
    ----------------------------------------------------------- */

    /// Create an empty table; no huge loops or data writes
    public entry fun init(board_signer: &signer) {
        assert!(
            !exists<Board>(signer::address_of(board_signer)),
            0
        );
        let empty_table = table::new<u64, Pixel>();
        move_to(board_signer, Board { pixels: empty_table });
    }

    /* -----------------------------------------------------------
       INTERNAL: collect payment
    ----------------------------------------------------------- */

    fun collect_payment(payer: &signer, count: u64) {
        let total = PRICE_PER_PIXEL * count;
        coin::transfer<AptosCoin>(payer, @pixel_board_admin, total);
    }

    /* -----------------------------------------------------------
       PUBLIC ENTRY FUNCTIONS
    ----------------------------------------------------------- */

    /// Batch purchase of **new** pixels
    public entry fun buy_pixels(
        payer: &signer,
        idx:   vector<u64>,
        argbs: vector<u32>,
        links: vector<vector<u8>>,
    ) acquires Board {
        let n = vector::length(&idx);
        assert!(n == vector::length(&argbs) && n == vector::length(&links), 100);
        collect_payment(payer, n);

        let board = borrow_global_mut<Board>(@pixel_board_admin);

        let i = 0;
        while (i < n) {
            let id = *vector::borrow(&idx, i);
            assert!(id < WIDTH * HEIGHT, 101);
            assert!(!table::contains<u64, Pixel>(&board.pixels, id), 102);

            let link_ref = vector::borrow(&links, i);
            assert!(vector::length(link_ref) <= MAX_LINK_LEN, 103);

            table::add<u64, Pixel>(
                &mut board.pixels,
                id,
                Pixel {
                    owner: signer::address_of(payer),
                    argb:  *vector::borrow(&argbs, i),
                    link:  *vector::borrow(&links, i),
                },
            );
            i = i + 1;
        }
    }

    /// Batch update of pixels already owned by caller
    public entry fun update_pixels(
        owner: &signer,
        idx:   vector<u64>,
        argbs: vector<u32>,
        links: vector<vector<u8>>,
    ) acquires Board {
        let n = vector::length(&idx);
        assert!(n == vector::length(&argbs) && n == vector::length(&links), 200);

        let board = borrow_global_mut<Board>(@pixel_board_admin);

        let i = 0;
        while (i < n) {
            let id = *vector::borrow(&idx, i);
            assert!(id < WIDTH * HEIGHT, 201);
            assert!(table::contains<u64, Pixel>(&board.pixels, id), 202);

            let pix = table::borrow_mut<u64, Pixel>(&mut board.pixels, id);
            assert!(pix.owner == signer::address_of(owner), 203);

            let link_ref = vector::borrow(&links, i);
            assert!(vector::length(link_ref) <= MAX_LINK_LEN, 204);

            pix.argb = *vector::borrow(&argbs, i);
            pix.link = *vector::borrow(&links, i);
            i = i + 1;
        }
    }

    /// View the entire board - returns only purchased pixels along with their coordinates
    /// Returns a vector of PixelWithId for all purchased pixels
    /// Empty pixels don't need to be returned as they're known to be white
    public fun view_board(): vector<PixelWithId> acquires Board {
        let result = vector::empty<PixelWithId>();
        let board = borrow_global<Board>(@pixel_board_admin);
        
        // Since the table doesn't have a built-in keys() function,
        // we'll need to check all possible pixel IDs.
        // This is expensive, but is only used for admin/display purposes.
        let id = 0;
        let total_pixels = WIDTH * HEIGHT;
        
        while (id < total_pixels) {
            if (table::contains<u64, Pixel>(&board.pixels, id)) {
                let pixel = *table::borrow<u64, Pixel>(&board.pixels, id);
                let pixel_with_id = PixelWithId { id, pixel };
                vector::push_back(&mut result, pixel_with_id);
            };
            id = id + 1;
        };
        
        result
    }

    /* -----------------------------------------------------------
       VIEW HELPERS
    ----------------------------------------------------------- */

    /// Read a pixel; returns default white if never purchased
    public fun view_pixel(idx: u64): Pixel acquires Board {
        assert!(idx < WIDTH * HEIGHT, 300);
        let board = borrow_global<Board>(@pixel_board_admin);
        if (table::contains<u64, Pixel>(&board.pixels, idx)) {
            *table::borrow<u64, Pixel>(&board.pixels, idx)
        } else {
            Pixel { owner: @0x0, argb: 0xFFFFFFFF, link: vector::empty<u8>() }
        }
    }

    /// Get the owner address of a pixel
    public fun get_pixel_owner(pixel: &Pixel): address {
        pixel.owner
    }

    /// Get the ARGB color of a pixel
    public fun get_pixel_color(pixel: &Pixel): u32 {
        pixel.argb
    }

    /// Get the link of a pixel
    public fun get_pixel_link(pixel: &Pixel): vector<u8> {
        pixel.link
    }

    /// Get the ID from a PixelWithId
    public fun get_pixel_id(pixel_with_id: &PixelWithId): u64 {
        pixel_with_id.id
    }

    /// Get the Pixel from a PixelWithId
    public fun get_pixel(pixel_with_id: &PixelWithId): Pixel {
        pixel_with_id.pixel
    }
}
