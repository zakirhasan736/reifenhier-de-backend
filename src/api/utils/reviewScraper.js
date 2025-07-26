
import axios from "axios";
import * as cheerio from "cheerio";

export async function getReifenRating(url, productId = "product") {
    try {
        const { data: html } = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const $ = cheerio.load(html);

        // Extract rating & review count
        const visualRatingSpan = $('span.-average').first();
        const visualRatingText = visualRatingSpan.text().trim();
        const rating = parseFloat(visualRatingText.replace(",", "."));
        const countMeta = $('meta[itemprop="ratingCount"]');
        const countText = countMeta.attr("content") || '';
        const reviewCount = parseInt(countText);

        // Extract gallery images
        const gallery_images = [];
        // 1. Try swiper-slide img (gallery images)
        let imgs = $(".shop-main__inner .gridl.-detailgrid .gridl-img .image-module .image-swiper .swiper-wrapper .swiper-slide img");
        if (imgs.length === 0) {
            // 2. Fallback: get static images in swiper-wrapper (if gallery is missing)
            imgs = $(".shop-main__inner .gridl.-detailgrid .gridl-img .image-module .image-swiper img");
        }
        imgs.each((i, el) => {
            let src = $(el).attr("data-src") || $(el).attr("src");
            if (src && src.includes("/images/")) {
                if (!src.startsWith("http")) src = `https://www.reifen.com${src}`;
                gallery_images.push(src);
            }
        });
        
        // Extract structured label data
        function normalizeBg(bg) {
            if (!bg) return null;
            if (bg.startsWith("//")) return "https:" + bg;
            if (bg.startsWith("/")) return "https://www.reifen.com" + bg;
            return bg;
        }
        const el = $(".c-eulabel").first();
        let tyre_label_info = null;
        if (el.length > 0) {
            const loud = el.find(".c-eulabel__loud");
            let loud_classes = null;
            const classesEl = loud.find(".c-eulabel__classes");
            if (classesEl.length > 0) {
                loud_classes = [];
                classesEl.find("span").each((_, span) => {
                    loud_classes.push($(span).text().trim());
                });
            }
            tyre_label_info = {
                supplier: el.find(".c-eulabel__supplier").text().trim() || null,
                identifier: el.find(".c-eulabel__identifier").text().trim() || null,
                size: el.find(".c-eulabel__size").text().trim() || null,
                efficiency_class: el.find(".c-eulabel__fuel").attr("data-class") || null,
                fuel_bg: normalizeBg(el.find(".c-eulabel__fuel").attr("data-bg") || null),
                wet_grip_class: el.find(".c-eulabel__wet").attr("data-class") || null,
                wet_bg: normalizeBg(el.find(".c-eulabel__wet").attr("data-bg") || null),
                noise_level_db: loud.attr("data-value") || null,
                loud_bg: normalizeBg(loud.attr("data-bg") || null),
                noise_class: loud.attr("data-class") || null,
                loud_classes,
                snow_icon: el.find(".c-eulabel__snow").length > 0,
                regulation: el.find(".c-eulabel__info").text().trim() || null,
            };
        }

        return {
            rating: isNaN(rating) ? 0 : rating,
            reviewCount: isNaN(reviewCount) ? 0 : reviewCount,
            gallery_images,
            tyre_label_info,
        };
    } catch (err) {
        console.warn("❌ Scrape failed:", url, err.message);
        return {
            rating: 0,
            reviewCount: 0,
            gallery_images: [],
            tyre_label_info: null,
        };
    }
}

