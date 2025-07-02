import Product from '../../models/product.js';

export const getAllVendorsSummary = async (req, res) => {
    try {
        const result = await Product.aggregate([
            { $unwind: '$offers' },
            {
                $group: {
                    _id: '$offers.vendor',
                    vendor_id: { $first: '$offers.vendor_id' },
                    vendor_logo: { $first: '$offers.vendor_logo' },
                    totalProducts: { $addToSet: '$_id' },
                },
            },
            {
                $project: {
                    _id: 0,
                    vendor: '$_id',
                    vendor_logo: 1,
                    vendor_id: 1,
                    totalProducts: { $size: '$totalProducts' },
                },
            },
            { $sort: { vendor: 1 } },
        ]);

        res.status(200).json({
            message: 'All vendors from offers',
            vendors: result,
            totalVendors: result.length,
        });
    } catch (error) {
        console.error('Error in getAllVendorsSummary:', error);
        res.status(500).json({ message: 'Failed to fetch vendor summaries.', error: error.message });
    }
};

export const deleteVendor = async (req, res) => {
    try {
        const vendorName = decodeURIComponent(req.params.vendorName);

        if (!vendorName) {
            return res.status(400).json({ message: 'Vendor name is required.' });
        }

        // Remove matching offers from all products
        const updateResult = await Product.updateMany(
            { 'offers.vendor': { $regex: `^${vendorName}$`, $options: 'i' } },
            { $pull: { offers: { vendor: { $regex: `^${vendorName}$`, $options: 'i' } } } }
        );

        // Remove products that now have zero offers
        const deleteResult = await Product.deleteMany({ offers: { $size: 0 } });

        return res.status(200).json({
            message: `Vendor "${vendorName}" deleted. Removed offers from ${updateResult.modifiedCount} products and deleted ${deleteResult.deletedCount} empty products.`,
        });
    } catch (error) {
        console.error('Error deleting vendor:', error);
        return res.status(500).json({
            message: 'Failed to delete vendor.',
            error: error.message,
        });
    }
  };