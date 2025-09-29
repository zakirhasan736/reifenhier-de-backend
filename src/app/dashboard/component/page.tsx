import React from 'react'

const ComponentsPage = () => {
  return (
    <>
    
            <div className="themesflat-container full">
                                    <div className="row">
                                        <div className="col-xl-4 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Alerts</h3>
                                                <div className="block-warning">
                                                    <i className="icon-alert-octagon"></i>
                                                    <div className="body-title-2">Your license is invalid. Please activate your license!</div>
                                                </div>
                                                <div className="block-warning w-full">
                                                    <i className="icon-alert-octagon"></i>
                                                    <div className="body-title-2">Your license is invalid. Please activate your license!</div>
                                                </div>
                                                <div className="block-warning type-main">
                                                    <i className="icon-alert-octagon"></i>
                                                    <div className="body-title-2">Blacklist contact requests if it includes those keywords in the content field (separate by comma).</div>
                                                </div>
                                                <div className="block-warning type-main w-full">
                                                    <i className="icon-alert-octagon"></i>
                                                    <div className="body-title-2">Blacklist contact requests if it includes those keywords in the content field (separate by comma).</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-xl-4 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Button</h3>
                                                <div className="flex items-center gap10 flex-wrap">
                                                    <p>Use class .tf-button</p>
                                                    <button className="tf-button">Add product</button>
                                                </div>
                                                <div className="flex items-center gap10 flex-wrap">
                                                    <p>Use .style-1 in class .btn class to change style 1</p>
                                                    <button className="tf-button style-1">Add product</button>
                                                </div>
                                                <div className="flex items-center gap10 flex-wrap">
                                                    <p>Use .style-2 in class .btn class to change style 2</p>
                                                    <button className="tf-button style-2">Add product</button>
                                                </div>
                                                <div className="flex items-center gap10 flex-wrap">
                                                    <p>Button funtion</p>
                                                    <div className="tf-button-funtion">
                                                        <i className="icon-upload-cloud"></i>
                                                        <div className="body-title">Upload</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap10 flex-wrap">
                                                    <p>Radio buttons</p>
                                                    <div className="radio-buttons">
                                                        <div className="item">
                                                            <input className="" type="radio" name="admin-language" id="admin-language1" />
                                                            <label className="" htmlFor="admin-language1"><span className="body-title-2">Left to Right</span></label>
                                                        </div>
                                                        <div className="item">
                                                            <input className="" type="radio" name="admin-language" id="admin-language2" />
                                                            <label className="" htmlFor="admin-language2"><span className="body-title-2">Right to Left</span></label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-xl-4 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Badges</h3>
                                                <div className="flex items-center gap10 flex-wrap">
                                                    <p>Use class .block-not-available</p>
                                                    <div className="block-not-available">Not Available</div>
                                                </div>
                                                <div className="flex items-center gap10 flex-wrap">
                                                    <p>Use class .block-available</p>
                                                    <div className="block-available">Available</div>
                                                </div>
                                                <div className="flex items-center gap10 flex-wrap">
                                                    <p>Use class .block-published</p>
                                                    <div className="block-published">Published</div>
                                                </div>
                                                <div className="flex items-center gap10 flex-wrap">
                                                    <p>Use class .block-pending</p>
                                                    <div className="block-pending">Pending</div>
                                                </div>
                                            </div>
                                        </div>
                                       
                                        <div className="col-12 mb-20">
                                            <div className="wg-box">
                                                <h3>Chart</h3>
                                                <div className="row">
                                                    <div className="col-xl-6 mb-20">
                                                        <div>
                                                            <h5 className="mb-16">Chart default</h5>
                                                            <div className="wrap-chart">
                                                                <div id="line-chart-1"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-6 mb-20">
                                                        <div>
                                                            <h5 className="mb-16">Chart bar</h5>
                                                            <div className="wrap-chart">
                                                                <div id="line-chart-6"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-6 mb-20">
                                                        <div>
                                                            <h5 className="mb-16">Chart area</h5>
                                                            <div className="wrap-chart">
                                                                <div id="line-chart-7"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-6 mb-20">
                                                        <div>
                                                            <h5 className="mb-16">Chart bar two column</h5>
                                                            <div className="wrap-chart">
                                                                <div id="line-chart-14"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-6 mb-20">
                                                        <div>
                                                            <h5 className="mb-16">Chart bar full column</h5>
                                                            <div className="wrap-chart">
                                                                <div id="line-chart-18"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-6 mb-20">
                                                        <div>
                                                            <h5 className="mb-16">Chart line</h5>
                                                            <div className="wrap-chart">
                                                                <div id="line-chart-15"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-4 mb-20">
                                                        <div>
                                                            <h5 className="mb-16">Chart half donut</h5>
                                                            <div className="wrap-chart">
                                                                <div id="line-chart-9"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-4 mb-20">
                                                        <div>
                                                            <h5 className="mb-16">Chart donut</h5>
                                                            <div className="flex justify-center">
                                                                <div id="morris-donut-1"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-4 mb-20">
                                                        <div>
                                                            <h5 className="mb-16">Chart map</h5>
                                                            <div id="usa-vectormap"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-12 mb-20">
                                            <div className="wg-box">
                                                <h3>Dropdowns</h3>
                                                <div className="row">
                                                    <div className="col-xl-4 mb-20">
                                                        <div>
                                                            <h6 className="mb-10">Select has image</h6>
                                                            <div className="flex items-center gap10 flex-wrap">
                                                                <p>Use &lt;select&gt; and class .image-select.no-text</p>
                                                                <select className="image-select no-text">
                                                                    <option data-thumbnail="images/country/1.png">ENG</option>
                                                                    <option data-thumbnail="images/country/9.png">VIE</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-4 mb-20">
                                                        <div>
                                                            <h6 className="mb-10">Dropdowns has content</h6>
                                                            <div className="flex items-center gap10 flex-wrap">
                                                                <p>Dropdown default</p>
                                                                <div className="popup-wrap noti type-header">
                                                                    <div className="dropdown">
                                                                        <button className="btn btn-secondary dropdown-toggle" type="button" id="dropdownButton1" data-bs-toggle="dropdown" aria-expanded="false">
                                                                            <span className="item">
                                                                                <span className="text-tiny">1</span>
                                                                                <i className="icon-bell"></i>
                                                                            </span>
                                                                        </button>
                                                                        <ul className="dropdown-menu has-content" aria-labelledby="dropdownButton1" >
                                                                            <li>
                                                                                <h6>Message</h6>
                                                                            </li>
                                                                            <li>
                                                                                <div className="noti-item w-full wg-user active">
                                                                                    <div className="image">
                                                                                        <img src="/images/avatar/user-11.png" alt="" />
                                                                                    </div>
                                                                                    <div className="flex-grow">
                                                                                        <div className="flex items-center justify-between">
                                                                                            <a href="#" className="body-title">Cameron Williamson</a>
                                                                                            <div className="time">10:13 PM</div>
                                                                                        </div>
                                                                                        <div className="text-tiny">Hello?</div>
                                                                                    </div>
                                                                                </div>
                                                                            </li>
                                                                            <li>
                                                                                <div className="noti-item w-full wg-user active">
                                                                                    <div className="image">
                                                                                        <img src="/images/avatar/user-12.png" alt="" />
                                                                                    </div>
                                                                                    <div className="flex-grow">
                                                                                        <div className="flex items-center justify-between">
                                                                                            <a href="#" className="body-title">Ralph Edwards</a>
                                                                                            <div className="time">10:13 PM</div>
                                                                                        </div>
                                                                                        <div className="text-tiny">Are you there?  interested i this...</div>
                                                                                    </div>
                                                                                </div>
                                                                            </li>
                                                                            <li>
                                                                                <div className="noti-item w-full wg-user active">
                                                                                    <div className="image">
                                                                                        <img src="/images/avatar/user-13.png" alt="" />
                                                                                    </div>
                                                                                    <div className="flex-grow">
                                                                                        <div className="flex items-center justify-between">
                                                                                            <a href="#" className="body-title">Eleanor Pena</a>
                                                                                            <div className="time">10:13 PM</div>
                                                                                        </div>
                                                                                        <div className="text-tiny">Interested in this loads?</div>
                                                                                    </div>
                                                                                </div>
                                                                            </li>
                                                                            <li>
                                                                                <div className="noti-item w-full wg-user active">
                                                                                    <div className="image">
                                                                                        <img src="/images/avatar/user-11.png" alt="" />
                                                                                    </div>
                                                                                    <div className="flex-grow">
                                                                                        <div className="flex items-center justify-between">
                                                                                            <a href="#" className="body-title">Jane Cooper</a>
                                                                                            <div className="time">10:13 PM</div>
                                                                                        </div>
                                                                                        <div className="text-tiny">Okay...Do we have a deal?</div>
                                                                                    </div>
                                                                                </div>
                                                                            </li>
                                                                            <li><a href="#" className="tf-button w-full">View all</a></li>
                                                                        </ul>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap10 flex-wrap">
                                                                <p>Dropdown end : add class .dropdown-menu-end in ul.dropdown-menu</p>
                                                                <div className="popup-wrap noti type-header">
                                                                    <div className="dropdown">
                                                                        <button className="btn btn-secondary dropdown-toggle" type="button" id="dropdownButton2" data-bs-toggle="dropdown" aria-expanded="false">
                                                                            <span className="item">
                                                                                <span className="text-tiny">1</span>
                                                                                <i className="icon-bell"></i>
                                                                            </span>
                                                                        </button>
                                                                        <ul className="dropdown-menu dropdown-menu-end has-content" aria-labelledby="dropdownButton2" >
                                                                            <li>
                                                                                <h6>Message</h6>
                                                                            </li>
                                                                            <li>
                                                                                <div className="noti-item w-full wg-user active">
                                                                                    <div className="image">
                                                                                        <img src="/images/avatar/user-11.png" alt="" />
                                                                                    </div>
                                                                                    <div className="flex-grow">
                                                                                        <div className="flex items-center justify-between">
                                                                                            <a href="#" className="body-title">Cameron Williamson</a>
                                                                                            <div className="time">10:13 PM</div>
                                                                                        </div>
                                                                                        <div className="text-tiny">Hello?</div>
                                                                                    </div>
                                                                                </div>
                                                                            </li>
                                                                            <li>
                                                                                <div className="noti-item w-full wg-user active">
                                                                                    <div className="image">
                                                                                        <img src="/images/avatar/user-12.png" alt="" />
                                                                                    </div>
                                                                                    <div className="flex-grow">
                                                                                        <div className="flex items-center justify-between">
                                                                                            <a href="#" className="body-title">Ralph Edwards</a>
                                                                                            <div className="time">10:13 PM</div>
                                                                                        </div>
                                                                                        <div className="text-tiny">Are you there?  interested i this...</div>
                                                                                    </div>
                                                                                </div>
                                                                            </li>
                                                                            <li>
                                                                                <div className="noti-item w-full wg-user active">
                                                                                    <div className="image">
                                                                                        <img src="/images/avatar/user-13.png" alt="" />
                                                                                    </div>
                                                                                    <div className="flex-grow">
                                                                                        <div className="flex items-center justify-between">
                                                                                            <a href="#" className="body-title">Eleanor Pena</a>
                                                                                            <div className="time">10:13 PM</div>
                                                                                        </div>
                                                                                        <div className="text-tiny">Interested in this loads?</div>
                                                                                    </div>
                                                                                </div>
                                                                            </li>
                                                                            <li>
                                                                                <div className="noti-item w-full wg-user active">
                                                                                    <div className="image">
                                                                                        <img src="/images/avatar/user-11.png" alt="" />
                                                                                    </div>
                                                                                    <div className="flex-grow">
                                                                                        <div className="flex items-center justify-between">
                                                                                            <a href="#" className="body-title">Jane Cooper</a>
                                                                                            <div className="time">10:13 PM</div>
                                                                                        </div>
                                                                                        <div className="text-tiny">Okay...Do we have a deal?</div>
                                                                                    </div>
                                                                                </div>
                                                                            </li>
                                                                            <li><a href="#" className="tf-button w-full">View all</a></li>
                                                                        </ul>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-4 mb-20">
                                                        <div>
                                                            <h6 className="mb-10">More</h6>
                                                            <div className="flex items-center gap10 flex-wrap">
                                                                <p>Dropdown more</p>
                                                                <div className="dropdown default">
                                                                    <button className="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                                       <span className="icon-more"><i className="icon-more-horizontal"></i></span>
                                                                    </button>
                                                                    <ul className="dropdown-menu dropdown-menu-end">
                                                                        <li>  
                                                                            <a href="javascript:void(0);">This Week</a>
                                                                        </li>
                                                                        <li>  
                                                                            <a href="javascript:void(0);">Last Week</a>
                                                                        </li>
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-4 mb-20">
                                                        <div>
                                                            <h6 className="mb-10">View all</h6>
                                                            <div className="flex items-center gap10 flex-wrap">
                                                                <p>Dropdown view all</p>
                                                                <div className="dropdown default">
                                                                    <button className="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                                        <span className="view-all">View all<i className="icon-chevron-down"></i></span>
                                                                    </button>
                                                                    <ul className="dropdown-menu dropdown-menu-end">
                                                                        <li>  
                                                                            <a href="javascript:void(0);">3 days</a>
                                                                        </li>
                                                                        <li>  
                                                                            <a href="javascript:void(0);">7 days</a>
                                                                        </li>
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-4 mb-20">
                                                        <div>
                                                            <h6 className="mb-10">Sort</h6>
                                                            <div className="flex items-center gap10 flex-wrap">
                                                                <p>Use &lt;select&gt; and class .style-default</p>
                                                                <div className="select style-default">
                                                                    <select className="">
                                                                        <option>Sort</option>
                                                                        <option>Name</option>
                                                                        <option>Day</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-4 mb-20">
                                                        <div>
                                                            <h6 className="mb-10">Box dropdown no select</h6>
                                                            <div className="dropdown default style-box">
                                                                <button className="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                                    <span className="view-all">Week<i className="icon-chevron-down"></i></span>
                                                                </button>
                                                                <ul className="dropdown-menu">
                                                                    <li>  
                                                                        <a href="javascript:void(0);">Month</a>
                                                                    </li>
                                                                    <li>  
                                                                        <a href="javascript:void(0);">Year</a>
                                                                    </li>
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-4 mb-20">
                                                        <div>
                                                            <h6 className="mb-10">Box dropdown select</h6>
                                                            <div className="select">
                                                                <select className="">
                                                                    <option>EU - 44</option>
                                                                    <option>EU - 40</option>
                                                                    <option>EU - 50</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-12 mb-20">
                                            <div className="wg-box">
                                                <h3>Form</h3>
                                                <div className="row">
                                                    <div className="col-xl-4 mb-20">
                                                        <div>
                                                            <h5 className="mb-16">Form search</h5>
                                                            <form className="form-search">
                                                                <fieldset className="name">
                                                                    <input type="text" placeholder="Search here..." className="" name="name" tabIndex={2} aria-required={true} required />
                                                                </fieldset>
                                                                <div className="button-submit">
                                                                    <button className="" type="submit"><i className="icon-search"></i></button>
                                                                </div>
                                                            </form>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-4 mb-20">
                                                        <div>
                                                            <h5 className="mb-16">Form select date</h5>
                                                            <form className="" >
                                                                <div className="select">
                                                                    <input type="date" name="date" defaultValue="2023-11-20" />
                                                                </div>
                                                            </form>
                                                        </div>
                                                    </div>
                                                    <div className="col-xl-4 mb-20">
                                                        <div>
                                                            <h5 className="mb-16">Form checkbox</h5>
                                                            <form className="">
                                                                <div className="wrap-checkbox">
                                                                    <ul className="table-title flex gap20 mb-14">
                                                                        <li className="countries-item">
                                                                            <div className="mb-10">
                                                                                <input className="total-checkbox" type="checkbox" />
                                                                            </div>
                                                                            <div className="body-text">Stt</div>
                                                                        </li>
                                                                        <li className="countries-item">
                                                                            <div className="mb-10">
                                                                                <input className="checkbox-item" type="checkbox"/>
                                                                            </div>
                                                                            <div className="body-text">#01</div>
                                                                        </li>
                                                                        <li className="countries-item">
                                                                            <div className="mb-10">
                                                                                <input className="checkbox-item" type="checkbox"/>
                                                                            </div>
                                                                            <div className="body-text">#02</div>
                                                                        </li>
                                                                        <li className="countries-item">
                                                                            <div className="mb-10">
                                                                                <input className="checkbox-item" type="checkbox"/>
                                                                            </div>
                                                                            <div className="body-text">#03</div>
                                                                        </li>
                                                                        <li className="countries-item">
                                                                            <div className="mb-10">
                                                                                <input className="checkbox-item" type="checkbox"/>
                                                                            </div>
                                                                            <div className="body-text">#04</div>
                                                                        </li>
                                                                        <li className="countries-item">
                                                                            <div className="mb-10">
                                                                                <input className="checkbox-item" type="checkbox"/>
                                                                            </div>
                                                                            <div className="body-text">#05</div>
                                                                        </li>
                                                                    </ul>
                                                                </div>
                                                            </form>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-12 mb-20">
                                            <div className="wg-box">
                                                <h3>Form text</h3>
                                                <div className="row">
                                                    <div className="col-12 mb-20">
                                                        <div>
                                                            <form className="">
                                                                <fieldset className="name mb-24">
                                                                    <div className="body-title mb-10">Name <span className="tf-color-1">*</span></div>
                                                                    <input className="" type="text" placeholder="Name" name="text" tabIndex={0}  aria-required="true" required/>
                                                                </fieldset>
                                                                <fieldset className="email mb-24">
                                                                    <div className="body-title mb-10">Admin email</div>
                                                                    <input className="flex-grow" type="email" placeholder="Enter your email" name="email" tabIndex={0}  aria-required="true" required/>
                                                                </fieldset>
                                                                <fieldset className="description mb-24">
                                                                    <div className="body-title mb-10">Description <span className="tf-color-1">*</span></div>
                                                                    <textarea className="" name="description" placeholder="Description" tabIndex={0} aria-required="true" required/>
                                                                </fieldset>
                                                                <div className="bot">
                                                                    <button className="tf-button w208" type="submit">Save</button>
                                                                </div>
                                                            </form>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-12 mb-20">
                                            <div className="wg-box">
                                                <h3>Form text</h3>
                                                <div className="row">
                                                    <div className="col-12 mb-20">
                                                        <form className="form-style-1" >
                                                            <fieldset className="name mb-24">
                                                                <div className="body-title">Product name <span className="tf-color-1">*</span></div>
                                                                <input className="flex-grow" type="text" placeholder="Category name" name="text" tabIndex={0}  aria-required="true" required/>
                                                            </fieldset>
                                                            <fieldset className="email mb-24">
                                                                <div className="body-title mb-10">Admin email</div>
                                                                <input className="flex-grow" type="email" placeholder="Enter your email" name="email" tabIndex={0}  aria-required="true" required/>
                                                            </fieldset>
                                                            <div className="bot">
                                                                <div></div>
                                                                <button className="tf-button w208" type="submit">Save</button>
                                                            </div>
                                                        </form>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-12 mb-20">
                                            <div className="wg-box">
                                                <h3>Add image</h3>
                                                <div className="row">
                                                    <div className="col-12 mb-20">
                                                        <div className="upload-image mb-16">
                                                            <div className="item">
                                                                <img src="/images/images-section/gallery-1.png" alt="" />
                                                            </div>
                                                            <div className="item">
                                                                <img src="/images/images-section/gallery-2.png" alt="" />
                                                            </div>
                                                            <div className="item">
                                                                <img src="/images/images-section/gallery-3.png" alt="" />
                                                            </div>
                                                            <div className="item">
                                                                <img src="/images/images-section/gallery-4.png" alt="" />
                                                            </div>
                                                            <div className="item up-load">
                                                                <label className="uploadfile" htmlFor="myFile">
                                                                    <span className="icon">
                                                                        <i className="icon-upload-cloud"></i>
                                                                    </span>
                                                                    <span className="text-tiny">Drop your images here or select <span className="tf-color">click to browse</span></span>
                                                                    <input type="file" id="myFile" name="filename" />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-xl-4 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Offcanvas</h3>
                                                <div className="setting cursor-pointer" data-bs-toggle="offcanvas" data-bs-target="#offcanvasRight1" aria-controls="offcanvasRight1">
                                                    <p>Offcanvas Right</p>
                                                </div>
                                                <div className="setting cursor-pointer" data-bs-toggle="offcanvas" data-bs-target="#offcanvasStart1" aria-controls="offcanvasStart1">
                                                    <p>Offcanvas Left</p>
                                                </div>
                                                <div className="setting cursor-pointer" data-bs-toggle="offcanvas" data-bs-target="#offcanvasTop1" aria-controls="offcanvasTop1">
                                                    <p>Offcanvas Top</p>
                                                </div>
                                                <div className="setting cursor-pointer" data-bs-toggle="offcanvas" data-bs-target="#offcanvasBottom1" aria-controls="offcanvasBottom1">
                                                    <p>Offcanvas Bottom</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-xl-4 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Pagination</h3>
                                                <div>
                                                    <p className="mb-10">Pagination start</p>
                                                    <ul className="wg-pagination">
                                                        <li>
                                                            <a href="#"><i className="icon-chevron-left"></i></a>
                                                        </li>
                                                        <li>
                                                            <a href="#">1</a>
                                                        </li>
                                                        <li className="active">
                                                            <a href="#">2</a>
                                                        </li>
                                                        <li>
                                                            <a href="#">3</a>
                                                        </li>
                                                        <li>
                                                            <a href="#"><i className="icon-chevron-right"></i></a>
                                                        </li>
                                                    </ul>
                                                </div>
                                                <div>
                                                    <p className="mb-10">Pagination center : add class .justify-content-center</p>
                                                    <ul className="wg-pagination justify-content-center">
                                                        <li>
                                                            <a href="#"><i className="icon-chevron-left"></i></a>
                                                        </li>
                                                        <li>
                                                            <a href="#">1</a>
                                                        </li>
                                                        <li className="active">
                                                            <a href="#">2</a>
                                                        </li>
                                                        <li>
                                                            <a href="#">3</a>
                                                        </li>
                                                        <li>
                                                            <a href="#"><i className="icon-chevron-right"></i></a>
                                                        </li>
                                                    </ul>
                                                </div>
                                                <div>
                                                    <p className="mb-10">Pagination end : add class .justify-content-end</p>
                                                    <ul className="wg-pagination justify-content-end">
                                                        <li>
                                                            <a href="#"><i className="icon-chevron-left"></i></a>
                                                        </li>
                                                        <li>
                                                            <a href="#">1</a>
                                                        </li>
                                                        <li className="active">
                                                            <a href="#">2</a>
                                                        </li>
                                                        <li>
                                                            <a href="#">3</a>
                                                        </li>
                                                        <li>
                                                            <a href="#"><i className="icon-chevron-right"></i></a>
                                                        </li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-xl-4 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Progress</h3>
                                                <div className="flex items-center justify-between gap10">
                                                    <div className="text-tiny">20%</div>
                                                    <div className="progress-level-bar w-full">
                                                        <span data-progress="20" data-max="100" className=""></span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between gap10">
                                                    <div className="text-tiny">40%</div>
                                                    <div className="progress-level-bar t1 w-full">
                                                        <span data-progress="40" data-max="100" className=""></span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between gap10">
                                                    <div className="text-tiny">50%</div>
                                                    <div className="progress-level-bar t2 w-full">
                                                        <span data-progress="50" data-max="100" className=""></span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between gap10">
                                                    <div className="text-tiny">60%</div>
                                                    <div className="progress-level-bar t3 w-full">
                                                        <span data-progress="60" data-max="100" className=""></span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between gap10">
                                                    <div className="text-tiny">80%</div>
                                                    <div className="progress-level-bar t4 w-full">
                                                        <span data-progress="80" data-max="100" className=""></span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between gap10">
                                                    <div className="text-tiny">100%</div>
                                                    <div className="progress-level-bar t5 w-full">
                                                        <span data-progress="100" data-max="100" className=""></span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-xl-4 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Tabs</h3>
                                                <div>
                                                    <h5 className="mb-16">Tabs default</h5>
                                                    <div className="widget-tabs">
                                                        <ul className="widget-menu-tab">
                                                            <li className="item-title active">
                                                                <span className="inner"><span className="h6">Tabs 1</span></span>
                                                            </li>
                                                            <li className="item-title">
                                                                <span className="inner"><span className="h6">Tabs 2</span></span>
                                                            </li>
                                                        </ul>
                                                        <div className="widget-content-tab">
                                                            <div className="widget-content-inner active">
                                                                <p>
                                                                    Lorem ipsum dolor, sit amet consectetur adipisicing elit. Quo molestias saepe id dolores at sed, numquam vero, amet iure reiciendis exercitationem ut laudantium! Voluptas tempora architecto dicta ex a eum?
                                                                    Neque distinctio, deleniti enim, similique accusantium saepe asperiores sed aperiam tenetur itaque ullam quidem qui minus culpa minima, id pariatur unde. Eum, nobis? Animi consequatur et dolorum distinctio veniam assumenda.
                                                                </p>
                                                            </div>
                                                            <div className="widget-content-inner">
                                                                <p>
                                                                    Lorem ipsum dolor sit amet consectetur, adipisicing elit. Repellat fugit doloribus quibusdam a quae? Eveniet modi obcaecati, quis a debitis minima! Optio libero quam vitae expedita quisquam minus voluptatem debitis?
                                                                    Aspernatur minima reprehenderit culpa rerum, asperiores recusandae. Sunt molestias fugiat impedit, porro itaque iusto dolor consectetur excepturi, tenetur quae sed architecto ab explicabo voluptate at modi! Expedita quisquam accusantium quas.
                                                                    Aliquam placeat beatae iste eos optio enim in, aperiam ipsa qui similique sapiente, quos exercitationem tempore, obcaecati libero quas aut repellendus rerum ab vitae dicta dolor a dignissimos modi. Maxime.
                                                                    Pariatur harum mollitia numquam impedit vitae magnam quo quaerat dignissimos ipsam sunt, itaque beatae, sequi velit! Voluptas magni adipisci mollitia minus, veniam illo excepturi commodi odit nihil tempora eum impedit.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h5 className="mb-16">Tabs style 1</h5>
                                                    <div className="widget-tabs">
                                                        <ul className="widget-menu-tab style-1">
                                                            <li className="item-title active">
                                                                <span className="inner"><span className="h6">Tabs 1</span></span>
                                                            </li>
                                                            <li className="item-title">
                                                                <span className="inner"><span className="h6">Tabs 2</span></span>
                                                            </li>
                                                        </ul>
                                                        <div className="widget-content-tab">
                                                            <div className="widget-content-inner active">
                                                                <p>
                                                                    Lorem ipsum dolor, sit amet consectetur adipisicing elit. Quo molestias saepe id dolores at sed, numquam vero, amet iure reiciendis exercitationem ut laudantium! Voluptas tempora architecto dicta ex a eum?
                                                                    Neque distinctio, deleniti enim, similique accusantium saepe asperiores sed aperiam tenetur itaque ullam quidem qui minus culpa minima, id pariatur unde. Eum, nobis? Animi consequatur et dolorum distinctio veniam assumenda.
                                                                </p>
                                                            </div>
                                                            <div className="widget-content-inner">
                                                                <p>
                                                                    Lorem ipsum dolor sit amet consectetur, adipisicing elit. Repellat fugit doloribus quibusdam a quae? Eveniet modi obcaecati, quis a debitis minima! Optio libero quam vitae expedita quisquam minus voluptatem debitis?
                                                                    Aspernatur minima reprehenderit culpa rerum, asperiores recusandae. Sunt molestias fugiat impedit, porro itaque iusto dolor consectetur excepturi, tenetur quae sed architecto ab explicabo voluptate at modi! Expedita quisquam accusantium quas.
                                                                    Aliquam placeat beatae iste eos optio enim in, aperiam ipsa qui similique sapiente, quos exercitationem tempore, obcaecati libero quas aut repellendus rerum ab vitae dicta dolor a dignissimos modi. Maxime.
                                                                    Pariatur harum mollitia numquam impedit vitae magnam quo quaerat dignissimos ipsam sunt, itaque beatae, sequi velit! Voluptas magni adipisci mollitia minus, veniam illo excepturi commodi odit nihil tempora eum impedit.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-xl-4 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Typography</h3>
                                                <p>Display Headings</p>
                                                <h1>h1</h1>
                                                <h2>h2</h2>
                                                <h3>h3</h3>
                                                <h4>h4</h4>
                                                <h5>h5</h5>
                                                <h6>h5</h6>
                                                <div className="body-title">body title</div>
                                                <div className="body-title-2">body title 2</div>
                                                <div className="body-text">body text</div>
                                                <div className="text-tiny">text tiny</div>
                                            </div>
                                        </div>
                                        <div className="col-xl-4 mb-20">
                                            <div className="wg-box h-full">
                                                <h3 className="mb-16">Other</h3>
                                                <div>
                                                    <h5 className="mb-10">Rating</h5>
                                                    <div className="flex items-center gap10">
                                                        <p>Rating default</p>
                                                        <div className="ratings">
                                                            <i className="icon-star1 active"></i>
                                                            <i className="icon-star1 active"></i>
                                                            <i className="icon-star1 active"></i>
                                                            <i className="icon-star1 active"></i>
                                                            <i className="icon-star1"></i>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap10">
                                                        <p>Rating has number</p>
                                                        <div className="rating-number">
                                                            <div className="icon">
                                                                <i className="icon-star1"></i>
                                                            </div>
                                                            <div className="number body-text">4.7</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h5 className="mb-10">List box text</h5>
                                                    <div className="list-box-value mb-10">
                                                        <div className="box-value-item"><div className="body-text">EU - 38.5</div></div>
                                                        <div className="box-value-item"><div className="body-text">EU - 39</div></div>
                                                        <div className="box-value-item"><div className="body-text">EU - 40</div></div>
                                                        <div className="box-value-item"><div className="body-text">EU - 38.5</div></div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h5 className="mb-10">List icon function</h5>
                                                    <div className="list-icon-function">
                                                        <div className="item eye">
                                                            <i className="icon-eye"></i>
                                                        </div>
                                                        <div className="item edit">
                                                            <i className="icon-edit-3"></i>
                                                        </div>
                                                        <div className="item trash">
                                                            <i className="icon-trash-2"></i>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-xl-4 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Box icon</h3> 
                                                <div className="">
                                                    <p>Change number up</p>
                                                    <div className="box-icon-trending up">
                                                        <i className="icon-trending-up"></i>
                                                        <div className="body-title number">1.56%</div>
                                                    </div>
                                                    <div className="flex items-center gap10">
                                                        <h4>$37,802</h4>
                                                        <div className="box-icon-trending up">
                                                            <i className="icon-trending-up"></i>
                                                            <div className="body-title number">1.56%</div>
                                                        </div>
                                                        <div className="text-tiny">since last weekend</div>
                                                    </div>
                                                </div>
                                                <div className="">
                                                    <p>No-change number</p>
                                                    <div className="box-icon-trending">
                                                        <i className="icon-trending-up"></i>
                                                        <div className="body-title number">0.00%</div>
                                                    </div>
                                                    <div className="flex items-center gap10">
                                                        <h4>$37,802</h4>
                                                        <div className="box-icon-trending">
                                                            <i className="icon-trending-up"></i>
                                                            <div className="body-title number">0.00%</div>
                                                        </div>
                                                        <div className="text-tiny">since last weekend</div>
                                                    </div>
                                                </div>
                                                <div className="">
                                                    <p>Change number down</p>
                                                    <div className="box-icon-trending down">
                                                        <i className="icon-trending-down"></i>
                                                        <div className="body-title number">1.56%</div>
                                                    </div>
                                                    <div className="flex items-center gap10">
                                                        <h4>$37,802</h4>
                                                        <div className="box-icon-trending down">
                                                            <i className="icon-trending-down"></i>
                                                            <div className="body-title number">1.56%</div>
                                                        </div>
                                                        <div className="text-tiny">since last weekend</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-xl-4 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Breadcrumb</h3>
                                                <ul className="breadcrumbs flex items-center flex-wrap justify-start gap10">
                                                    <li>
                                                        <a href="index-2.html"><div className="text-tiny">Dashboard</div></a>
                                                    </li>
                                                    <li>
                                                        <i className="icon-chevron-right"></i>
                                                    </li>
                                                    <li>
                                                        <a href="#"><div className="text-tiny">Ecommerce</div></a>
                                                    </li>
                                                    <li>
                                                        <i className="icon-chevron-right"></i>
                                                    </li>
                                                    <li>
                                                        <div className="text-tiny">Add product</div>
                                                    </li>
                                                </ul>
                                                <ul className="breadcrumbs flex items-center flex-wrap justify-start gap10">
                                                    <li>
                                                        <a href="index-2.html"><div className="text-tiny">Dashboard</div></a>
                                                    </li>
                                                    <li>
                                                        <i className="icon-chevron-right"></i>
                                                    </li>
                                                    <li>
                                                        <div className="text-tiny">Setting</div>
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                        <div className="col-xl-4 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Gallery item</h3>
                                                <div className="row">
                                                    <div className="col-xl-12 mb-20">
                                                        <div className="flex">
                                                            <a href="#" className="gallery-item">
                                                                <div className="image">
                                                                    <img src="/images/images-section/all-gallery-4.png" alt="" />
                                                                </div>
                                                                <div className="text-tiny">Feed for dogs and cats – Brit</div>
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-12 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Product item</h3>
                                                <div className="row">
                                                    <div className="col-12 mb-20">
                                                        <div className="product-item">
                                                            <div className="image">
                                                                <img src="/images/products/1.png" alt="" />
                                                            </div>
                                                            <div className="flex items-center justify-between flex-grow">
                                                                <div className="name">
                                                                    <a href="product-list.html" className="body-title-2">Patimax Fragrance Long...</a>
                                                                    <div className="text-tiny mt-3">100 Items</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-tiny mb-3">Coupon Code</div>
                                                                    <div className="body-text">Sflat</div>
                                                                </div>
                                                                <div className="country">
                                                                    <img src="/images/country/2.png" alt="" />
                                                                </div>
                                                                <div>
                                                                    <div className="body-title-2 mb-3">-15%</div>
                                                                    <div className="text-tiny">$27.00</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-12 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Country item</h3>
                                                <div className="row">
                                                    <div className="col-12 mb-20">
                                                        <div className="country-item">
                                                            <div className="image">
                                                                <img src="/images/country/6.png" alt="" />
                                                            </div>
                                                            <div className="flex-grow flex items-center justify-between">
                                                                <a href="countries.html" className="body-text name">Turkish Flag</a>
                                                                <div className="box-icon-trending up">
                                                                    <i className="icon-trending-up"></i>
                                                                </div>
                                                                <div className="body-text number">6,972</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-12 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Shop item</h3>
                                                <div className="row">
                                                    <div className="col-12 mb-20">
                                                        <div className="shop-item">
                                                            <div className="image">
                                                                <img src="/images/shop/1.png" alt="" />
                                                            </div>
                                                            <div className="flex-grow flex items-center justify-between gap20">
                                                                <div>
                                                                    <a href="#" className="body-text name">Robert</a>
                                                                    <div className="text-tiny mt-4">73 Purchases</div>
                                                                </div>
                                                                <div className="body-text">Kitchen, Pets</div>
                                                                <div className="body-text">$1,000</div>
                                                                <div className="flex items-center justify-between gap10">
                                                                    <div className="progress-level-bar">
                                                                        <span data-progress="29" data-max="70" className="" style={{ width: "41.4286%" }}></span>
                                                                    </div>
                                                                    <div className="text-tiny">100%</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-12 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Comment item</h3>
                                                <div className="row">
                                                    <div className="col-12 mb-20">
                                                        <div className="comment-item">
                                                            <div className="image">
                                                                <img src="/images/avatar/user-4.png" alt="" />
                                                            </div>
                                                            <div className="">
                                                                <div className="mb-4 name">
                                                                    <a href="all-user.html" className="body-title-2">Devon Lane</a>
                                                                </div>
                                                                <div className="ratings mb-10">
                                                                    <i className="icon-star1 active"></i>
                                                                    <i className="icon-star1 active"></i>
                                                                    <i className="icon-star1 active"></i>
                                                                    <i className="icon-star1 active"></i>
                                                                    <i className="icon-star1"></i>
                                                                </div>
                                                                <div className="text-tiny">Morbi eget commodo diam. Praesent dignissim purus ac turpis porta</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-12 mb-20">
                                            <div className="wg-box h-full">
                                                <h3>Attribute item</h3>
                                                <div className="row">
                                                    <div className="col-12 mb-20">
                                                        <div className="attribute-item flex items-center justify-between gap20 mb-10">
                                                            <div className="name">
                                                                <a href="add-attributes.html" className="body-title-2">Color</a>
                                                            </div>
                                                            <div className="body-text">Blue, green, white</div>
                                                            <div className="list-icon-function">
                                                                <div className="item eye">
                                                                    <i className="icon-eye"></i>
                                                                </div>
                                                                <div className="item edit">
                                                                    <i className="icon-edit-3"></i>
                                                                </div>
                                                                <div className="item trash">
                                                                    <i className="icon-trash-2"></i>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="attribute-item flex items-center justify-between gap20">
                                                            <div className="name">
                                                                <a href="add-attributes.html" className="body-title-2">Size</a>
                                                            </div>
                                                            <div className="body-text">S, M, L, XL</div>
                                                            <div className="list-icon-function">
                                                                <div className="item eye">
                                                                    <i className="icon-eye"></i>
                                                                </div>
                                                                <div className="item edit">
                                                                    <i className="icon-edit-3"></i>
                                                                </div>
                                                                <div className="item trash">
                                                                    <i className="icon-trash-2"></i>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-12">
                                            <div className="wg-box h-full">
                                                <h3>Roadmap</h3>
                                                <div className="road-map">
                                                    <div className="road-map-item active">
                                                        <div className="icon"><i className="icon-check"></i></div>
                                                        <h6>Receiving orders</h6>
                                                        <div className="body-text">05:43 AM</div>
                                                    </div>
                                                    <div className="road-map-item active">
                                                        <div className="icon"><i className="icon-check"></i></div>
                                                        <h6>Order processing</h6>
                                                        <div className="body-text">01:21 PM</div>
                                                    </div>
                                                    <div className="road-map-item active">
                                                        <div className="icon"><i className="icon-check"></i></div>
                                                        <h6>Being delivered</h6>
                                                        <div className="body-text">Processing</div>
                                                    </div>
                                                    <div className="road-map-item">
                                                        <div className="icon"><i className="icon-check"></i></div>
                                                        <h6>Delivered</h6>
                                                        <div className="body-text">Pending</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                    </div>
                                </div>
    </>
  )
}

export default ComponentsPage
