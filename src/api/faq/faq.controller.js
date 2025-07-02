// controllers/faq.controller.js
import FAQ from '../../models/FAQ.js';

export const getAllFAQs = async (req, res) => {
    try {
        const faqs = await FAQ.find().sort({ createdAt: -1 });
        res.status(200).json(faqs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching FAQs', error: error.message });
    }
};

export const createFAQ = async (req, res) => {
    try {
        const { question, answer } = req.body;
        const newFaq = await FAQ.create({ question, answer });
        res.status(201).json(newFaq);
    } catch (error) {
        res.status(500).json({ message: 'Error creating FAQ', error: error.message });
    }
};

export const updateFAQ = async (req, res) => {
    try {
        const { id } = req.params;
        const { question, answer } = req.body;
        const updated = await FAQ.findByIdAndUpdate(id, { question, answer }, { new: true });
        res.status(200).json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating FAQ', error: error.message });
    }
};

export const deleteFAQ = async (req, res) => {
    try {
        const { id } = req.params;
        await FAQ.findByIdAndDelete(id);
        res.status(200).json({ message: 'FAQ deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting FAQ', error: error.message });
    }
};
