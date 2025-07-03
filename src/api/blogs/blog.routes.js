import express from 'express';
import {
    createBlog,
    getAllBlogs,
    getBlogById,
    getSingleBlog,
    updateBlog,
    deleteBlog,
    upload,
} from './blog.controller.js';

const router = express.Router();

// Admin routes
router.post('/create', upload.single('coverImage'), createBlog);
router.put('/update/:id', upload.single('coverImage'), updateBlog);
router.delete('/delete/:id', deleteBlog);
router.get('/list', getAllBlogs);
router.get('/slug/:slug', getSingleBlog);
router.get('/:id', getBlogById);


export default router;
