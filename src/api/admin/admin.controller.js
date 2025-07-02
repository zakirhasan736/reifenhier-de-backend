import Product from '../../models/product.js';

export const getAllBrandsSummary = async (req, res) => {
    try {
        const { page = 1, limit = 24 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const pipeline = [
            {
                $group: {
                    _id: '$brand_name',
                    brand_logo: { $first: '$brand_logo' },
                    totalProducts: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    brand_name: '$_id',
                    brand_logo: 1,
                    totalProducts: 1,
                },
            },
            {
                $sort: { brand_name: 1 },
            },
        ];

        const totalBrands = (await Product.aggregate(pipeline)).length;

        const paginatedBrands = await Product.aggregate([
            ...pipeline,
            { $skip: skip },
            { $limit: Number(limit) },
        ]).allowDiskUse(true);

        return res.status(200).json({
            message: 'Paginated brand summaries',
            brands: paginatedBrands,
            totalBrands,
            currentPage: Number(page),
            limit: Number(limit),
        });
    } catch (error) {
        console.error('Error in getAllBrandsSummary:', error);
        return res.status(500).json({
            message: 'Failed to fetch brand summaries.',
            error: error.message,
        });
    }
};

// controllers/admin.controller.js
export const getProductsByBrand = async (req, res) => {
    try {
        const { brand } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const filter = { brand_name: brand };

        const total = await Product.countDocuments(filter);
        const products = await Product.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .select('product_name merchant_product_third_category product_image search_price status brand_name offers vendor in_stock createdAt');

        return res.status(200).json({
            brand,
            total,
            currentPage: Number(page),
            limit: Number(limit),
            products,
        });
    } catch (error) {
        console.error('Error in getProductsByBrand:', error);
        return res.status(500).json({
            message: 'Failed to fetch products by brand.',
            error: error.message,
        });
    }
};
  

export const getAdminProductsPaginated = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const products = await Product.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .select(
                'product_name product_image brand_name _id merchant_product_third_category search_price offers vendor_name in_stock createdAt description delivery_cost delivery_time'
            );

        const total = await Product.countDocuments();

        return res.status(200).json({
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / limit),
            products,
        });
    } catch (error) {
        console.error('Error fetching admin product list:', error);
        return res.status(500).json({
            message: 'Failed to fetch products.',
            error: error.message,
        });
    }
  };

export const deleteProductById = async (req, res) => {
    try {
        const { id } = req.params;
        await Product.findByIdAndDelete(id);

        return res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        return res.status(500).json({
            message: 'Failed to delete product',
            error: error.message,
        });
    }
};


